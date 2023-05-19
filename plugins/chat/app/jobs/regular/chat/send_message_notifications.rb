# frozen_string_literal: true

module Jobs
  module Chat
    class SendMessageNotifications < ::Jobs::Base
      def execute(args)
        reason = args[:reason]
        valid_reasons = %w[new edit]
        return unless valid_reasons.include?(reason)

        return if (timestamp = args[:timestamp]).blank?

        return if (message = ::Chat::Message.find_by(id: args[:chat_message_id])).nil?

        if reason == "new"
          to_notify = ::Chat::Notifier.new(message, timestamp).notify_new
          notify_mentioned_users(message.id, timestamp, to_notify)
        elsif reason == "edit"
          ::Chat::Notifier.new(message, timestamp).notify_edit
        end
      end

      private

      def notify_mentioned_users(message_id, timestamp, to_notify, already_notified_user_ids: [])
        Jobs.enqueue(
          Jobs::Chat::NotifyMentioned,
          {
            chat_message_id: message_id,
            to_notify_ids_map: to_notify.as_json,
            already_notified_user_ids: already_notified_user_ids,
            timestamp: timestamp,
          },
        )
      end
    end
  end
end
