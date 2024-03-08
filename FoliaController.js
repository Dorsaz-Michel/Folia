export default class FoliaController {

    #req;
    #res;
    #plugins;

    constructor({ server, module, config, routes, plugins, router, method, path, handler, policies, controller, action, req, res, next }) {
        this.#req = req;
        this.#res = res;
        this.#plugins = plugins;
    }

    getPlugin(name) {
        if (name.prototype)
            name = name.name;
        return this.#plugins[name].get();
    }

    /**
     *
     * @return {Request}
     */
    getRequest() {
        return this.#req;
    }

    /**
     *
     * @return {Response}
     */
    getResponse() {
        return this.#res;
    }

    /**
     *
     * @param {string} name
     * @param {*} value
     */
    setSession(name, value) {
        this.#req.session.set(name, value);
    }

    /**
     *
     * @param {string} name
     * @return {*}
     */
    getSession(name) {
        return this.#req.session.get(name);
    }

    _response = null;

    onPost(callback) {
        if (!this._response && this.#req.method === "POST")
            this._response = callback();
    }

    onGet(callback) {
        if (!this._response && this.#req.method === "GET")
            this._response = callback();
    }
}