import FoliaResponse from "./FoliaResponse.js";

export default class RedirectResponse extends FoliaResponse {
    url;

    /**
     *
     * @param {string} url
     */
    constructor(url) {
        super();
        this.url = url;
    }

    send(res) {
        if (!this.url)
            throw new Error(`'url' not found in ${this.constructor.name} !`);

        res.redirect(this.url);
    }

}