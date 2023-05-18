import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import hbs from "htmlbars-inline-precompile";
import fabricators from "discourse/plugins/chat/discourse/lib/fabricators";
import { render, waitFor } from "@ember/test-helpers";
import { module, test } from "qunit";
import pretender from "discourse/tests/helpers/create-pretender";
import { publishToMessageBus } from "discourse/tests/helpers/qunit-helpers";

module(
  "Discourse Chat | Component | chat-channel | mentions",
  function (hooks) {
    setupRenderingTest(hooks);

    const channelId = 1;
    const actingUser = {
      id: 1,
      username: "acting_user",
    };
    const mentionedUser = {
      id: 1000,
      username: "user1",
      status: {
        description: "surfing",
        emoji: "surfing_man",
      },
    };
    const mentionedUser2 = {
      id: 2000,
      username: "user2",
      status: {
        description: "vacation",
        emoji: "desert_island",
      },
    };
    const messagesResponse = {
      meta: {
        channel_id: channelId,
      },
      chat_messages: [
        {
          id: 1891,
          message: `Hey @${mentionedUser.username}`,
          cooked: `<p>Hey <a class="mention" href="/u/${mentionedUser.username}">@${mentionedUser.username}</a></p>`,
          mentioned_users: [mentionedUser],
          user: {
            id: 1,
            username: "jesse",
          },
        },
      ],
    };

    hooks.beforeEach(function () {
      this.channel = fabricators.channel({
        id: channelId,
        currentUserMembership: { following: true },
        meta: { can_join_chat_channel: false },
      });

      pretender.get(`/chat/${channelId}/messages`, () => [
        200,
        {},
        messagesResponse,
      ]);
      pretender.post(`/chat/${channelId}`, () => OK);
      pretender.post("/chat/drafts", () => OK);

      this.appEvents = this.container.lookup("service:appEvents");
    });

    test("it shows status on mentions", async function (assert) {
      await render(hbs`<ChatChannel @channel={{this.channel}} />`);

      assert
        .dom(".mention .user-status")
        .exists("status is rendered")
        .hasAttribute(
          "title",
          mentionedUser.status.description,
          "status description is correct"
        )
        .hasAttribute(
          "src",
          new RegExp(`${mentionedUser.status.emoji}.png`),
          "status emoji is updated"
        );
    });

    test("it updates status on mentions", async function (assert) {
      await render(hbs`<ChatChannel @channel={{this.channel}} />`);

      const newStatus = {
        description: "off to dentist",
        emoji: "tooth",
      };

      this.appEvents.trigger("user-status:changed", {
        [mentionedUser.id]: newStatus,
      });

      const selector = ".mention .user-status";
      await waitFor(selector);
      assert
        .dom(selector)
        .exists("status is rendered")
        .hasAttribute(
          "title",
          newStatus.description,
          "status description is updated"
        )
        .hasAttribute(
          "src",
          new RegExp(`${newStatus.emoji}.png`),
          "status emoji is updated"
        );
    });

    test("it deletes status on mentions", async function (assert) {
      await render(hbs`<ChatChannel @channel={{this.channel}} />`);

      this.appEvents.trigger("user-status:changed", {
        [mentionedUser.id]: null,
      });

      const selector = ".mention .user-status";
      await waitFor(selector, { count: 0 });
      assert.dom(selector).doesNotExist("status is deleted");
    });

    test("it shows status on mentions on messages that came from Message Bus", async function (assert) {
      await render(hbs`<ChatChannel @channel={{this.channel}} />`);

      await receiveMessageViaMessageBus();

      assert
        .dom(statusSelector(mentionedUser2.username))
        .exists("status is rendered")
        .hasAttribute(
          "title",
          mentionedUser2.status.description,
          "status description is correct"
        )
        .hasAttribute(
          "src",
          new RegExp(`${mentionedUser2.status.emoji}.png`),
          "status emoji is updated"
        );
    });

    async function receiveMessageViaMessageBus() {
      await publishToMessageBus(`/chat/${channelId}`, {
        chat_message: {
          id: 2138,
          message: `Hey @${mentionedUser2.username}`,
          cooked: `<p>Hey <a class="mention" href="/u/${mentionedUser2.username}">@${mentionedUser2.username}</a></p>`,
          created_at: "2023-05-18T16:07:59.588Z",
          excerpt: `Hey @${mentionedUser2.username}`,
          available_flags: [],
          thread_title: null,
          chat_channel_id: 7,
          mentioned_users: [mentionedUser2],
          user: actingUser,
          chat_webhook_event: null,
          uploads: [],
        },
        type: "sent",
      });
    }

    function statusSelector(username) {
      return `.mention[href='/u/${username}'] .user-status`;
    }

    const OK = [200, {}, {}];
  }
);
