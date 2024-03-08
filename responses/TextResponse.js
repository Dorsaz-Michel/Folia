import FoliaResponse from "./FoliaResponse.js";

export default class TextResponse extends FoliaResponse {

    text;
    constructor(text) {
        super();
        this.text = text;
    }

    send( res) {
        if (!this.text)
            throw new Error(`'text' not found in ${this.constructor.name} !`);

        res.send(this.text);
    }

}