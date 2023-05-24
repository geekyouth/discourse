# frozen_string_literal: true

module Chat
  class MentionNotificationsExpander
    def initialize(parsed_mentions, chat_channel, acting_user)
      @parsed_mentions = parsed_mentions
      @chat_channel = chat_channel
      @acting_user = acting_user
    end

    def expand
      skip_notifications = @parsed_mentions.count > SiteSetting.max_mentions_per_chat_message

      {}.tap do |to_notify|
        # The order of these methods is the precedence
        # between different mention types.

        already_covered_ids = []

        expand_direct_mentions(to_notify, already_covered_ids, skip_notifications)
        if !skip_notifications
          expand_group_mentions(to_notify, already_covered_ids)
          expand_here_mention(to_notify, already_covered_ids)
          expand_global_mention(to_notify, already_covered_ids)
        end

        filter_users_ignoring_or_muting_creator(to_notify, already_covered_ids)

        to_notify[:all_mentioned_user_ids] = already_covered_ids
      end
    end

    private

    def expand_direct_mentions(to_notify, already_covered_ids, skip)
      if skip
        direct_mentions = []
      else
        direct_mentions =
          @parsed_mentions
            .direct_mentions
            .not_suspended
            .where.not(username_lower: @acting_user.username_lower)
            .where.not(id: already_covered_ids)
      end

      grouped = group_users_to_notify(direct_mentions)

      to_notify[:direct_mentions] = grouped[:already_participating].map(&:id)
      to_notify[:welcome_to_join] = grouped[:welcome_to_join]
      to_notify[:unreachable] = grouped[:unreachable]
      already_covered_ids.concat(to_notify[:direct_mentions])
    end

    def expand_group_mentions(to_notify, already_covered_ids)
      return if @parsed_mentions.visible_groups.empty?

      reached_by_group =
        @parsed_mentions
          .group_mentions
          .not_suspended
          .where("user_count <= ?", SiteSetting.max_users_notified_per_group_mention)
          .where.not(username_lower: @acting_user.username_lower)
          .where.not(id: already_covered_ids)

      @parsed_mentions.groups_to_mention.each { |g| to_notify[g.name.downcase] = [] }

      grouped = group_users_to_notify(reached_by_group)
      grouped[:already_participating].each do |user|
        # When a user is a member of multiple mentioned groups,
        # the most far to the left should take precedence.
        ordered_group_names =
          @parsed_mentions.parsed_group_mentions &
            @parsed_mentions.groups_to_mention.map { |mg| mg.name.downcase }
        user_group_names = user.groups.map { |ug| ug.name.downcase }
        group_name = ordered_group_names.detect { |gn| user_group_names.include?(gn) }

        to_notify[group_name] << user.id
        already_covered_ids << user.id
      end

      to_notify[:welcome_to_join] = to_notify[:welcome_to_join].concat(grouped[:welcome_to_join])
      to_notify[:unreachable] = to_notify[:unreachable].concat(grouped[:unreachable])
    end

    def expand_global_mention(to_notify, already_covered_ids)
      has_all_mention = @parsed_mentions.has_global_mention

      if has_all_mention && @chat_channel.allow_channel_wide_mentions
        to_notify[:global_mentions] = @parsed_mentions
          .global_mentions
          .not_suspended
          .where(user_options: { ignore_channel_wide_mention: [false, nil] })
          .where.not(username_lower: @acting_user.username_lower)
          .where.not(id: already_covered_ids)
          .pluck(:id)

        already_covered_ids.concat(to_notify[:global_mentions])
      else
        to_notify[:global_mentions] = []
      end
    end

    def expand_here_mention(to_notify, already_covered_ids)
      has_here_mention = @parsed_mentions.has_here_mention

      if has_here_mention && @chat_channel.allow_channel_wide_mentions
        to_notify[:here_mentions] = @parsed_mentions
          .here_mentions
          .not_suspended
          .where(user_options: { ignore_channel_wide_mention: [false, nil] })
          .where.not(username_lower: @acting_user.username_lower)
          .where.not(id: already_covered_ids)
          .pluck(:id)

        already_covered_ids.concat(to_notify[:here_mentions])
      else
        to_notify[:here_mentions] = []
      end
    end

    # Filters out users from global, here, group, and direct mentions that are
    # ignoring or muting the creator of the message, so they will not receive
    # a notification via the Jobs::Chat::NotifyMentioned job and are not prompted for
    # invitation by the creator.
    def filter_users_ignoring_or_muting_creator(to_notify, already_covered_ids)
      screen_targets = already_covered_ids.concat(to_notify[:welcome_to_join].map(&:id))

      return if screen_targets.blank?

      screener = UserCommScreener.new(acting_user: @acting_user, target_user_ids: screen_targets)
      to_notify
        .except(:unreachable, :welcome_to_join)
        .each do |key, user_ids|
          to_notify[key] = user_ids.reject { |user_id| screener.ignoring_or_muting_actor?(user_id) }
        end

      # :welcome_to_join contains users because it's serialized by MB.
      to_notify[:welcome_to_join] = to_notify[:welcome_to_join].reject do |user|
        screener.ignoring_or_muting_actor?(user.id)
      end

      already_covered_ids.reject! do |already_covered|
        screener.ignoring_or_muting_actor?(already_covered)
      end
    end

    def group_users_to_notify(users)
      potential_participants, unreachable =
        users.partition do |user|
          guardian = Guardian.new(user)
          guardian.can_chat? && guardian.can_join_chat_channel?(@chat_channel)
        end

      participants, welcome_to_join =
        potential_participants.partition do |participant|
          participant.user_chat_channel_memberships.any? do |m|
            predicate = m.chat_channel_id == @chat_channel.id
            predicate = predicate && m.following == true if @chat_channel.public_channel?
            predicate
          end
        end

      {
        already_participating: participants || [],
        welcome_to_join: welcome_to_join || [],
        unreachable: unreachable || [],
      }
    end
  end
end
