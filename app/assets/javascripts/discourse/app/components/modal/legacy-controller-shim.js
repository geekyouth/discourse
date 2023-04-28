import templateOnly from "@ember/component/template-only";
import { dasherize } from "@ember/string";

let activeController;

export function connectLegacyController(name, opts, container) {
  const controllerName = opts.admin ? `modals/${name}` : name;
  let controller = container.lookup(`controller:${controllerName}`);
  const templateName = opts.templateName || dasherize(name);

  const renderArgs = { into: "application", outlet: "modalBody" };
  if (controller) {
    renderArgs.controller = controllerName;
  } else {
    // use a basic controller
    renderArgs.controller = "basic-modal-body";
    controller = container.lookup(`controller:${renderArgs.controller}`);
  }

  if (opts.addModalBodyView) {
    renderArgs.view = "modal-body";
  }

  const modalName = `modal/${templateName}`;
  const fullName = opts.admin ? `admin/templates/${modalName}` : modalName;
  container.lookup("route:application").render(fullName, renderArgs);

  controller.setProperties({
    modal: container.lookup("service:modal"),
    model: opts.model,
    flashMessage: null,
  });

  if (controller.onShow) {
    controller.onShow();
  }

  return (activeController = controller);
}

export function disconnectLegacyController(
  initiatedBy,
  controllerName,
  container
) {
  if (activeController?.beforeClose) {
    if (activeController.beforeClose() === false) {
      // controller cancelled close
      return false;
    }
  }

  container.lookup("route:application").render("hide-modal", {
    into: "application",
    outlet: "modalBody",
  });
  $(".d-modal.fixed-modal").modal("hide").addClass("hidden");

  if (activeController) {
    container.lookup("service:appEvents").trigger("modal:closed", {
      name: controllerName,
      controller: activeController,
    });

    if (activeController.onClose) {
      activeController.onClose({
        initiatedByCloseButton: initiatedBy === "initiatedByCloseButton",
        initiatedByClickOut: initiatedBy === "initiatedByClickOut",
        initiatedByESC: initiatedBy === "initiatedByESC",
      });
    }
  }

  activeController = null;

  return true;
}

export function controllerOnSelectPanel(panel) {
  const handler = activeController?.actions?.onSelectPanel;
  if (handler) {
    handler.apply(activeController, [panel]);
  }
}

export default templateOnly();
