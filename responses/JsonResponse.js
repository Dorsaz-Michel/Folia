import FoliaResponse from "./FoliaResponse.js";

export default class JsonResponse extends FoliaResponse{
    data;

    /**
     *
     * @param {*} data
     */
    constructor(data) {
        super();
        this.data = data;
    }

    send(res) {
        if (this.data === undefined)
            throw new Error(`'data' not found in ${this.constructor.name} !`);

        res.json(this.data);
    }
}