# frozen_string_literal: true

describe "Thread tracking state | full page", type: :system, js: true do
  fab!(:current_user) { Fabricate(:user) }
  fab!(:channel) { Fabricate(:chat_channel, threading_enabled: true) }
  fab!(:other_user) { Fabricate(:user) }
  fab!(:thread) { Fabricate(:chat_thread, channel: channel) }

  let(:chat_page) { PageObjects::Pages::Chat.new }
  let(:channel_page) { PageObjects::Pages::ChatChannel.new }
  let(:thread_page) { PageObjects::Pages::ChatThread.new }
  let(:thread_list_page) { PageObjects::Pages::ChatThreadList.new }

  before do
    SiteSetting.enable_experimental_chat_threaded_discussions = true
    chat_system_bootstrap(current_user, [channel])
    sign_in(current_user)
    thread.add(current_user)
  end

  context "when the user has unread messages for a thread" do
    fab!(:message_1) { Fabricate(:chat_message, chat_channel: channel, thread: thread) }
    fab!(:message_2) do
      Fabricate(:chat_message, chat_channel: channel, thread: thread, user: current_user)
    end

    it "shows the count of threads with unread messages on the thread list button" do
      chat_page.visit_channel(channel)
      expect(channel_page).to have_unread_thread_indicator(count: 1)
    end

    it "shows an indicator on the unread thread in the list" do
      chat_page.visit_channel(channel)
      channel_page.open_thread_list
      expect(thread_list_page).to have_unread_item(thread.id, count: 1)
    end

    it "marks the thread as read and removes both indicators when the user opens it" do
      chat_page.visit_channel(channel)
      channel_page.open_thread_list
      thread_list_page.item_by_id(thread.id).click
      expect(channel_page).to have_no_unread_thread_indicator
      channel_page.open_thread_list
      expect(thread_list_page).to have_no_unread_item(thread.id)
    end

    it "shows unread indicators for the header icon and the list when a new unread arrives" do
      message_1.trash!
      chat_page.visit_channel(channel)
      channel_page.open_thread_list
      expect(channel_page).to have_no_unread_thread_indicator
      expect(thread_list_page).to have_no_unread_item(thread.id)
      Fabricate(:chat_message, chat_channel: channel, thread: thread)
      expect(channel_page).to have_unread_thread_indicator(count: 1)
      expect(thread_list_page).to have_unread_item(thread.id)
    end

    it "does not change the unread indicator for the header icon when the user is not a member of the thread" do
      thread.remove(current_user)
      chat_page.visit_channel(channel)
      channel_page.open_thread_list
      Fabricate(:chat_message, chat_channel: channel, thread: thread)
      expect(channel_page).to have_no_unread_thread_indicator
      expect(thread_list_page).to have_no_unread_item(thread.id)
    end
  end
end
