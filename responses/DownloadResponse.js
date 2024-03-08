import FoliaResponse from "./FoliaResponse.js";

export default class DownloadResponse extends FoliaResponse {
    filePath;

    /**
     *
     * @param {string} filePath
     */
    constructor(filePath) {
        super();
        this.filePath = filePath;
    }

    send(res) {
        if (!this.filePath)
            throw new Error(`'filepath' not found in ${this.constructor.name} !`);

        res.download(this.filePath);
    }

}