import FoliaResponse from "./FoliaResponse.js";
import fs from "fs";

export default class ViewResponse extends FoliaResponse {

    file;
    path;
    replacements;

    /**
     * @param {{}?} replacements { search: replace } Replace specific part of html file
     */
    constructor(replacements = {}) {
        super();

        this.replacements = replacements;
    }

    /**
     * @param {string?} file If not specified: module/<controller>/<action>.html
     */
    setFile(file) {
        if (file.includes('/')) {
            let parts =  file.split('/');
            this.file = parts.pop();
            this.path = parts.join('/');
        }
        else
            this.file = file;

        if (!this.file.toLowerCase().endsWith('.html'))
            this.file += '.html';
    }

    prepare({ server, module, controller, action }) {
        if (!this.file)
            this.file = action + ".html";
        if (!this.path)
            this.path = `${server.MODULES_DIRECTORY_NAME}/${module}/${server.PATHS.MODULES.VIEWS_DIRECTORY}/${controller.name}`;
    }

    send( res) {

        let filepath = `${this.path}/${this.file}`;
        if (fs.existsSync(filepath)) {
            let fileContent = fs.readFileSync(filepath, 'utf8');

            Object.entries(this.replacements).forEach(([search, replace]) => {
                fileContent = fileContent.replaceAll(search, replace);
            })

            res.send(fileContent);
        }
        else
            throw new Error(`Unable to find file '${filepath}'`);
    }

}