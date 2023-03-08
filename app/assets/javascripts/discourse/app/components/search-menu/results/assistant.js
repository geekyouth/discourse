import Component from "@glimmer/component";
import { inject as service } from "@ember/service";
import { action } from "@ember/object";
import { bind } from "discourse-common/utils/decorators";
import { tracked } from "@glimmer/tracking";

const suggestionShortcuts = [
  "in:title",
  "in:pinned",
  "status:open",
  "status:closed",
  "status:public",
  "status:noreplies",
  "order:latest",
  "order:views",
  "order:likes",
  "order:latest_topic",
];

const SUGGESTION_KEYWORD_MAP = {
  "+": "tag",
  "#": "category",
  "@": "user",
};

export default class Assistant extends Component {
  @service router;
  @service currentUser;
  @service siteSettings;

  @tracked suggestionKeyword = this.args.suggestionKeyword;
  suggestionType;
  prefix;

  constructor() {
    super(...arguments);

    if (this.currentUser) {
      addSearchSuggestion("in:likes");
      addSearchSuggestion("in:bookmarks");
      addSearchSuggestion("in:mine");
      addSearchSuggestion("in:messages");
      addSearchSuggestion("in:seen");
      addSearchSuggestion("in:tracking");
      addSearchSuggestion("in:unseen");
      addSearchSuggestion("in:watching");
    }

    if (this.siteSettings.tagging_enabled) {
      addSearchSuggestion("in:tagged");
      addSearchSuggestion("in:untagged");
    }

    this.attributesForSuggestionKeyword();
  }

  @action
  prefixForResult(result) {
    debugger;
    return result;
    // when we loop through each result, set the prefix for each item
  }

  attributesForSuggestionKeyword() {
    if (this.suggestionKeyword !== "+") {
      this.prefix =
        this.args.term?.split(this.suggestionKeyword)[0].trim() || "";
      if (this.prefix.length) {
        this.prefix = `${this.prefix} `;
      }
    }

    switch (this.suggestionKeyword) {
      case "+":
        this.args.results.forEach((result) => {
          if (result.additionalTags) {
            this.prefix =
              this.args.term?.split(" ").slice(0, -1).join(" ").trim() || "";
          } else {
            this.prefix = this.args.term?.split("#")[0].trim() || "";
          }
          if (this.prefix.length) {
            this.prefix = `${this.prefix} `;
          }
          //content.push(
          //this.attach("search-menu-assistant-item", {
          //prefix: this.prefix,
          //tag: item.tagName,
          //additionalTags: item.additionalTags,
          //category: item.category,
          //slug: this.args.term,
          //withInLabel: this.args.withInLabel,
          //isIntersection: true,
          //})
          //);
        });
        this.suggestionType = SUGGESTION_KEYWORD_MAP[this.suggestionKeyword];
        break;
      case "#":
        this.args.results.forEach((item) => {
          if (item.model) {
            const fullSlug = item.model.parentCategory
              ? `#${item.model.parentCategory.slug}:${item.model.slug}`
              : `#${item.model.slug}`;
            //content.push(
            //this.attach("search-menu-assistant-item", {
            //prefix: this.prefix,
            //category: item.model,
            //slug: `${this.prefix}${fullSlug}`,
            //withInLabel: this.args.withInLabel,
            //})
            //);
          } else {
            //content.push(
            //this.attach("search-menu-assistant-item", {
            //prefix: this.prefix,
            //tag: item.name,
            //slug: `${this.prefix}#${item.name}`,
            //withInLabel: this.args.withInLabel,
            //})
            //);
          }
        });
        this.suggestionType = SUGGESTION_KEYWORD_MAP[this.suggestionKeyword];
        break;
      case "@":
        //when only one user matches while in topic
        //quick suggest user search in the topic or globally
        if (
          this.args.results.length === 1 &&
          this.router.currentRouteName.startsWith("topic.")
        ) {
          const user = this.args.results[0];
          //content.push(
          //this.attach("search-menu-assistant-item", {
          //prefix,
          //user,
          //setTopicContext: true,
          //slug: `${prefix}@${user.username}`,
          //suffix: h(
          //"span.label-suffix",
          //` ${I18n.t("search.in_this_topic")}`
          //),
          //})
          //);
          //content.push(
          //this.attach("search-menu-assistant-item", {
          //extraHint: I18n.t("search.enter_hint"),
          //prefix,
          //user,
          //slug: `${prefix}@${user.username}`,
          //suffix: h(
          //"span.label-suffix",
          //` ${I18n.t("search.in_topics_posts")}`
          //),
          //})
          //);
        } else {
          this.args.results.forEach((user) => {
            //content.push(
            //this.attach("search-menu-assistant-item", {
            //prefix,
            //user,
            //slug: `${prefix}@${user.username}`,
            //})
            //);
          });
        }
        this.suggestionType = SUGGESTION_KEYWORD_MAP[this.suggestionKeyword];
        break;
      default:
        suggestionShortcuts.forEach((item) => {
          if (item.includes(suggestionKeyword) || !suggestionKeyword) {
            //content.push(
            //this.attach("search-menu-assistant-item", {
            //slug: `${prefix}${item}`,
            //})
            //);
          }
        });
        break;
    }
    //return content.filter((c, i) => i <= 8);
  }
}

export function addSearchSuggestion(value) {
  if (!suggestionShortcuts.includes(value)) {
    suggestionShortcuts.push(value);
  }
}
