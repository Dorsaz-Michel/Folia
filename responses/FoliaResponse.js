export default class FoliaResponse {
    /**
     *
     * @param {Response} res
     * @return void
     */
    send(res) {
        throw new Error(`You must implements the 'send' method in ${this.constructor.name}!`);
    }

    prepare({ server, module, config, routes, plugins, router, method, path, handler, policies, controller, controllerInstance, action, req, res, next }) {

    }
}