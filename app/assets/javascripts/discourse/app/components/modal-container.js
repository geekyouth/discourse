import Component from "@glimmer/component";
import { inject as service } from "@ember/service";
import { action } from "@ember/object";

export default class ModalContainer extends Component {
  @service modal;
  @service appEvents;

  @action
  closeModal(initiatedBy) {
    this.modal.close(initiatedBy);
  }

  @action
  flash(text, messageClass) {
    this.appEvents.trigger("modal-body:flash", { text, messageClass });
  }

  @action
  clearFlash() {
    this.appEvents.trigger("modal-body:clearFlash");
  }
}
