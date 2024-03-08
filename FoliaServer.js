import express from "express";
import ConsoleProgressBar from "./ConsoleProgressBar.js";
import fs from "fs";

export default class FoliaServer {


    /** @type {Express} */
    app;

    /** @type {({init: Function, name: string, dependencies?: string[]})[]} */
    extensions = [];

    /** @type {string[]} */
    modules;

    /** @type {Object} */
    options;


    //=============================================================================
    // ARCHITECTURE CONFIGURATIONS
    //=============================================================================

    MODULES_DIRECTORY_NAME = 'module';
    APPLICATION_MODULE_NAME = 'Application';

    PATHS = {
        ROOT: process.cwd(),
        APPLICATION: {
            EXTENSIONS_FILE: `extensions/extensions.js`,
            LOCAL_FILE: `config/local.js`,
            DIST_LOCAL_FILE: `config/local.dist.js`
        },
        MODULES: {
            PLUGINS_DIRECTORY: `plugins`,
            ROUTES_FILE: 'routes/routes.js',
            CONFIG_FILE: 'config/config.js',
            CONTROLLERS_DIRECTORY: 'src/controllers',
            VIEWS_DIRECTORY: 'src/views'
        }
    }

    ARCHITECTURE = {
        BASE: [
            { path: `${this.MODULES_DIRECTORY_NAME}/${this.APPLICATION_MODULE_NAME}`, children:
                    [
                        { path: this.PATHS.APPLICATION.EXTENSIONS_FILE, content: "import SessionManager from \"../../../modules/session_management/SessionManager.js\";\nimport RouteManager from \"../../../modules/RouteManager.js\";\n" +
                                "\nexport default [\n    SessionManager,\n    RouteManager\n];" },
                        { path: this.PATHS.APPLICATION.LOCAL_FILE, content: "export default {\n    \n}" },
                        { path: this.PATHS.APPLICATION.DIST_LOCAL_FILE, content: "export default {\n    \n}" }
                    ]
            },
        ],
        MODULES: [
            { path: this.PATHS.MODULES.PLUGINS_DIRECTORY },
            { path: this.PATHS.MODULES.ROUTES_FILE, content: (module) => `import ${module} from "../src/controllers/${module}.js";\nimport Index from "../src/controllers/Index.js";\n\nexport default [\n   {\n       path: '/${module.toLowerCase()}',\n       controller: Index,\n       action: 'index',\n       children: [\n            {\n                path: '/${module.toLowerCase()}',\n                controller: ${module},\n                action: 'index',\n                children: [\n                    {\n                        path: '/list',\n                        action: 'list'\n                    }\n                ]\n            }\n        ]\n    }\n]` },
            { path: this.PATHS.MODULES.CONFIG_FILE, content: "export default {\n    \n}" },
            { path: this.PATHS.MODULES.CONTROLLERS_DIRECTORY, children:
                    [
                        { path: 'Index.js', content: `import FoliaController from "../../../../FoliaController.js";\n\nexport default class Index extends FoliaController {\n    index() {\n        \n    }\n}` },
                        { path: (module) => `${module}.js`, content: (module) => `import FoliaController from "../../../../FoliaController.js";\n\nexport default class ${module} extends FoliaController {\n    index() {\n\n    }\n\n    list() {\n\n    }\n}` }
                    ]
            },
            { path: this.PATHS.MODULES.VIEWS_DIRECTORY },
        ]
    }

    constructor() {
        this.app = express();
    }

    #messages = [];
    #showMessages() {
        this.#messages.forEach(msg => console.log(msg));
        this.#messages = [];
    }

    async init() {
        await this.#loadExtensions();
        await this.#loadArchitecture();
        await this.#loadModules();
    }


    /**
     * Check for missing files or folder and create them.
     */
    async #loadArchitecture() {

        let modulesDirectories = fs.readdirSync('./' + this.MODULES_DIRECTORY_NAME);
        let server = this;

        let data = { modules: modulesDirectories, directoriesToCreate: [], filesToCreate: {} }
        await this.emit(FoliaServerEvent.BEFORE_ARCHITECTURE_VERIFIED, data);

        //=============================================================================
        // VERIFY ARCHITECTURE
        //=============================================================================

        let baseEntriesToCreate = getEntriesToCreate(this.ARCHITECTURE.BASE);
        let moduleEntriesToCreate = getEntriesToCreate(this.ARCHITECTURE.MODULES);

        let architectureVerifyProgressBar = new ConsoleProgressBar(`VERIFYING ARCHITECTURE`, baseEntriesToCreate.length + (moduleEntriesToCreate.length * data.modules.length));
        let baseArchitectureVerifyProgressBar = architectureVerifyProgressBar.partialBar(`VERIFYING BASE ARCHITECTURE`, baseEntriesToCreate);


        function getEntriesToCreate(architecture, parentPath) {
            let entriesToCreate = [];

            architecture.forEach(({ path, content, children, requirePath }) => {

                if (parentPath) {

                    if (typeof path === 'function') {
                        let childPath = path;
                        path = (moduleName) => {
                            return parentPath + '/' + childPath(moduleName)
                        };
                    }
                    else
                        path = parentPath + '/' + path;

                    if (!requirePath)
                        requirePath = parentPath;
                }

                entriesToCreate.push({ path, content, requirePath });

                if (children)
                    entriesToCreate.push(...getEntriesToCreate(children, path));
            })

            return entriesToCreate;
        }

        await baseArchitectureVerifyProgressBar.forEach(entryToCreate => {
            if (!entryToCreate.requirePath || !fs.existsSync(entryToCreate.requirePath))
                verifyArchitecture(entryToCreate);
        })

        for (let i = 0; i < data.modules.length; i++){
            let module = data.modules[i];

            let moduleArchitectureVerifyProgressBar = architectureVerifyProgressBar.partialBar(`VERIFYING MODULE ${module.toUpperCase()}'S ARCHITECTURE`, moduleEntriesToCreate);

            await moduleArchitectureVerifyProgressBar.forEach(entryToCreate => {

                let {path, content, requirePath } = entryToCreate
                if (typeof path === 'function')
                    path = path(module);
                if (typeof content === 'function')
                    content = content(module);

                if (!requirePath || !fs.existsSync(`${this.MODULES_DIRECTORY_NAME}/${module}/${requirePath}`))
                    verifyArchitecture({ path: `${this.MODULES_DIRECTORY_NAME}/${module}/${path}`, content });
            })
        }


        //=============================================================================
        // UPDATING ARCHITECTURE
        //=============================================================================

        /** @param {{ path: string, content: string?}} entryToCreate */
        function verifyArchitecture(entryToCreate ) {
            let entryData = { entryToCreate };
            server.emit(FoliaServerEvent.ON_ARCHITECTURE_ENTRY_VERIFICATION_START, entryData);

            let fileToCreate = null;
            let directoriesToCreate = entryData.entryToCreate.path.split('/');

            if (entryData.entryToCreate.content)
                fileToCreate = directoriesToCreate.pop();


            let path = ".";
            directoriesToCreate.forEach(directoryName => {
                path += `/${directoryName}`;

                if (!fs.existsSync(path) && !data.directoriesToCreate.includes(path))
                    data.directoriesToCreate.push(path);
            });

            if (fileToCreate && !fs.existsSync(`${path}/${fileToCreate}`))
                data.filesToCreate[`${path}/${fileToCreate}`] = entryData.entryToCreate.content;

            server.emit(FoliaServerEvent.ON_ARCHITECTURE_ENTRY_VERIFICATION_END, entryData);
        }


        if (data.directoriesToCreate.length > 0 || Object.keys(data.filesToCreate).length > 0) {

            let updatingArchitectureVerifyProgressBar = new ConsoleProgressBar(`UPDATING ARCHITECTURE`, data.directoriesToCreate.length + Object.keys(data.filesToCreate).length);

            if (data.directoriesToCreate.length > 0) {
                let directoriesProgressBar = updatingArchitectureVerifyProgressBar.partialBar(`CREATING MISSING DIRECTORIES`, data.directoriesToCreate);
                await directoriesProgressBar.forEach(path => {
                    fs.mkdirSync(path);
                })
            }
            if (Object.keys(data.filesToCreate).length > 0) {
                let filesProgressBar = updatingArchitectureVerifyProgressBar.partialBar(`CREATING MISSING FILES`, Object.entries(data.filesToCreate));
                await filesProgressBar.forEach(([path, content]) => {
                    fs.writeFileSync(path, content);
                })
            }
        }


        //=============================================================================
        // VERIFYING LOCAL'S FILE CHANGES
        //=============================================================================

        if (this.PATHS.APPLICATION.LOCAL_FILE && this.PATHS.APPLICATION.DIST_LOCAL_FILE) {

            let local = (await import(`./${this.MODULES_DIRECTORY_NAME}/${this.APPLICATION_MODULE_NAME}/${this.PATHS.APPLICATION.LOCAL_FILE}`)).default;
            let distLocal = (await import(`./${this.MODULES_DIRECTORY_NAME}/${this.APPLICATION_MODULE_NAME}/${this.PATHS.APPLICATION.DIST_LOCAL_FILE}`)).default;

            if ((Object.keys(distLocal).length + Object.keys(local).length) > 0) {

                let localFileChangesVerifyProgressBar = new ConsoleProgressBar(`VERIFYING LOCAL'S FILE CHANGES`, Object.keys(distLocal).length + Object.keys(local).length);

                let distLocalFileVerifyProgressBar = localFileChangesVerifyProgressBar.partialBar(`CHECKING FOR MISSING KEYS IN ${this.PATHS.APPLICATION.DIST_LOCAL_FILE.toUpperCase()}`, Object.entries(distLocal));

                await distLocalFileVerifyProgressBar.forEach(([key, value]) => {
                    if (!local[key])
                        this.#messages.push(`WARNING: Entry '${key}' was added to '${this.PATHS.APPLICATION.DIST_LOCAL_FILE}' file but is missing in your local '${this.PATHS.APPLICATION.LOCAL_FILE}' !`);
                });

                let localFileVerifyProgressBar = localFileChangesVerifyProgressBar.partialBar(`CHECKING FOR MISSING KEYS IN ${this.PATHS.APPLICATION.LOCAL_FILE.toUpperCase()}`, Object.entries(local));

                await localFileVerifyProgressBar.forEach(([key, value]) => {
                    if (!distLocal[key])
                        this.#messages.push(`WARNING: You added { '${key}': '${value}' } to '${this.PATHS.APPLICATION.LOCAL_FILE}' but not to the dist file '${this.PATHS.APPLICATION.DIST_LOCAL_FILE}' !`);
                });
            }
        }

        await this.emit(FoliaServerEvent.AFTER_ARCHITECTURE_VERIFIED, data);


        this.#showMessages();
    }

    /**
     * Import extensions, verify that the dependencies are loaded and initialize each extension.
     */
     async #loadExtensions() {
        let extensions = (await import(`./${this.MODULES_DIRECTORY_NAME}/${this.APPLICATION_MODULE_NAME}/${this.PATHS.APPLICATION.EXTENSIONS_FILE}` )).default;
        let data = { extensions }
        await this.emit(FoliaServerEvent.BEFORE_EXTENSIONS_LOADED, data);

        let extensionsProgressBar = new ConsoleProgressBar(`LOADING EXTENSIONS`, data.extensions);
        await extensionsProgressBar.forEach(async (extension) => {
            let data = { extension };
            await this.emit(FoliaServerEvent.BEFORE_EXTENSION_LOADED, data);

            if (!data.extension.name)
                throw new Error(`Incorrect extension passed to ${this.constructor.name} !\nExpected '{ init:Function, name:string, dependencies?: string[]}' but no 'name' was found !`);
            if (typeof data.extension.init !== "function")
                throw new Error(`Incorrect extension passed to ${this.constructor.name} !\nExpected '{ init:Function, name:string, dependencies?: string[]}' but no 'init' function was found !`);

            if (data.extension.dependencies && data.extension.dependencies instanceof Array) {
                data.extension.dependencies.forEach(dependency => {
                    if (!this.extensions.find(extension => extension.name === dependency))
                        throw new Error(`Extension '${data.extension.name}' require extension '${dependency}' !`);
                })
            }

            this.extensions.push(data.extension);
            await data.extension.init(this);

            await this.emit(FoliaServerEvent.AFTER_EXTENSION_LOADED, data);
        });

        await this.emit(FoliaServerEvent.AFTER_EXTENSIONS_LOADED, data.extensions);

        this.#showMessages();
     }

    /**
     * Load global and modules routes by defining route-controller-action.
     * Configs and plugins are passed to controllers.
     */
    async #loadModules() {
        this.modules = fs.readdirSync('./' + this.MODULES_DIRECTORY_NAME);
        await this.emit(FoliaServerEvent.BEFORE_MODULES_LOADED, this.modules);

        let modulesProgressBar = new ConsoleProgressBar(`LOADING MODULES`, this.modules);

        let server = this;


        //=============================================================================
        // LOADING GLOBAL ROUTES
        //=============================================================================

        let globalConfig = (await import(`./${this.MODULES_DIRECTORY_NAME}/${this.APPLICATION_MODULE_NAME}/${this.PATHS.MODULES.CONFIG_FILE}`)).default;
        let globalRoutes = (await import(`./${this.MODULES_DIRECTORY_NAME}/${this.APPLICATION_MODULE_NAME}/${this.PATHS.MODULES.ROUTES_FILE}`)).default;
        let globalPlugins = await this.#loadPlugins(`${this.MODULES_DIRECTORY_NAME}/${this.APPLICATION_MODULE_NAME}/${this.PATHS.MODULES.PLUGINS_DIRECTORY}`);

        await server.#loadRoutes({ module: this.APPLICATION_MODULE_NAME, routes: globalRoutes, config: globalConfig, plugins: globalPlugins }, modulesProgressBar);


        //=============================================================================
        // LOADING MODULES ROUTES
        //=============================================================================

        await modulesProgressBar.forEach(async (module) => {
            if (module !== this.APPLICATION_MODULE_NAME) {
                let config = { ...globalConfig, ...(await import(`./${this.MODULES_DIRECTORY_NAME}/${module}/${this.PATHS.MODULES.CONFIG_FILE}`)).default };
                let routes =  (await import(`./${this.MODULES_DIRECTORY_NAME}/${module}/${this.PATHS.MODULES.ROUTES_FILE}`)).default;
                let plugins = { ...globalPlugins, ...(await this.#loadPlugins(`${this.MODULES_DIRECTORY_NAME}/${module}/${this.PATHS.MODULES.PLUGINS_DIRECTORY}`)) };

                let data = { server: this, module, config, routes, plugins };

                await this.emit(FoliaServerEvent.BEFORE_MODULE_LOADED, data);
                await server.#loadRoutes(data, modulesProgressBar);
                await this.emit(FoliaServerEvent.AFTER_MODULE_LOADED, data);
            }
        })

        //=============================================================================
        // ADDING DEFAULT ERROR HANDLER
        //=============================================================================
        this.app.use((err, req, res, next) => {
            console.log(err);
            res.status(500);
            if (req.xhr)
                res.send({ erro: err })
            else
                res.send(`<h1>${err.name}</h1><h3>${err.message}</h3><p>${err.stack.split('at').join('<br>at')}</p>`);
        })

        await this.emit(FoliaServerEvent.AFTER_MODULES_LOADED, this.modules);
    }

    /**
     *
     * @param {string} path
     * @return {Promise<{}>}
     */
    async #loadPlugins(path) {
        let plugins = {};

        let entries = fs.readdirSync(path, { withFileTypes: true });

        for (let i = 0; i < entries.length; i++) {
            let entry = entries[i];

            if (entry.isDirectory())
                plugins = {...plugins, ...(await this.#loadPlugins(`${path}/${entry.name}`))}
            else {
                let pluginClass = await this.#import(`${path}/${entry.name}`);
                plugins[pluginClass.name] = await pluginClass.init(this);
            }
        }

        return Promise.resolve(plugins);
    }

    async #import(path, returnDefaultExport = true) {
        let rootPath = process.platform === 'win32' ? `file://${this.PATHS.ROOT}` : this.PATHS.ROOT;
        if (returnDefaultExport)
            return (await import(`${rootPath}/${path}`)).default
        else
            return (await import(`${rootPath}/${path}`));
    }

    /**
     * Create relation route-controller-action and register it to Express
     * @param {{routes: [], module: string}} moduleData - Contains the routes to load, the module's name and other info passed to the controllers' constructor
     * @param modulesProgressBar - ProgessBar used to create subbars
     */
    async #loadRoutes(moduleData, modulesProgressBar) {

        await this.emit(FoliaServerEvent.BEFORE_MODULE_ROUTES_LOADED, moduleData);

        let routesProgressBar = modulesProgressBar.subBar(`LOADING ROUTES FOR MODULE ${moduleData.module.toUpperCase()}`, moduleData.routes);
        await routesProgressBar.forEach(async ({ router, method, path, handler, middlewares, controller, action }) => {
            let data = { ...moduleData, router, method, handler, path, middlewares, controller, action };
            await this.emit(FoliaServerEvent.BEFORE_ROUTE_LOADED, data);


            //=============================================================================
            // CHECK ROUTE'S DATA VALIDITY
            // Some data are validated later
            //=============================================================================

            if (method !== 'use') {
                if (!data.path)
                    throw new Error(`Missing 'path' in route definition`);
                if (typeof data.path !== "string")
                    throw new Error(`Incorrect type for route's path ! Expected 'string' but found '${typeof data.path}'`);
            }
            if (!data.method)
                throw new Error(`Missing 'method' in route !\nAt route with path '${data.path}'`);
            if (typeof data.method !== "string")
                throw new Error(`Incorrect type for route's method ! Expected 'string' but found '${typeof data.method}'\nAt route with path '${data.path}'`);
            if (!data.middlewares)
                data.middlewares = [];
            if (!(data.middlewares instanceof Array))
                throw new Error(`Incorrect type for route's middlewares ! Expected 'Function[]' but found '${typeof data.middlewares}'\nAt route with path '${data.path}'`);
            if (!data.router)
                data.router = this.app;

            data.middlewares = data.middlewares.map(hook => {
                if (hook.invoke)
                    return hook.invoke();
                if (typeof hook === "function")
                    return hook;

                throw new Error(`Incorrect type for route's hook ! Expected 'Function' or 'Object' with a 'invoke' method but found '${JSON.stringify(hook)}'\nAt route with path '${data.path}'`);
            })



            //=============================================================================
            // REGISTER ROUTES
            //=============================================================================

            if (data.method === 'use') {

                if (!data.handler)
                    throw new Error(`Missing 'handler' in route definition\nAt route with path '${data.path}'`);
                if (typeof data.handler !== "function")
                    throw new Error(`Incorrect type for route's handler ! Expected 'function' but found '${typeof data.handler}'\nAt route with path '${data.path}'`);


                if (data.path)
                    data.router[data.method](data.path, data.middlewares, data.handler); // app.use('/path', [...], (req, res, next) => {...})
                else
                    data.router[data.method](data.handler); // app.use((req, res, next) => {...})
            }
            else {

                if (!data.controller)
                    throw new Error(`Missing 'controller' in route !\nAt route with path '${data.path}'`);
                if (typeof data.controller !== "function" && typeof data.controller !== "object")
                    throw new Error(`Incorrect type for route's controller ! Expected 'Class' or 'Object' but found '${typeof data.controller}'\nAt route with path '${data.path}'`);
                if (!data.action)
                    throw new Error(`Missing 'action' in route !\nAt route with path '${data.path}'`);
                if (typeof data.action === "function")
                    data.action = data.action.name;
                if (typeof data.action !== "string")
                    throw new Error(`Incorrect type for route's action ! Expected 'string' but found '${typeof data.action}'\nAt route with path '${data.path}'`);

                let controller = new data.controller({}); // Dummy instance to check action's validity

                if (!controller[data.action])
                    throw new Error(`Missing action '${data.action}' in controller ${controller.constructor.name} !\nAt route with path '${data.path}'`);
                if (typeof controller[data.action] !== "function")
                    throw new Error(`Incorrect type for action '${data.action}' in controller ${controller.constructor.name} ! Expected 'function' but found '${typeof controller[data.action]}'\nAt route with path '${data.path}'`);


                //=============================================================================
                // REGISTERING ROUTE-CONTROLLER-ACTION
                //=============================================================================

                data.router[data.method](data.path, data.middlewares, async (req, res, next) => {
                    let reqData = data;
                    reqData.req = req;
                    reqData.res = res;
                    reqData.next = next;
                    await this.emit(FoliaServerEvent.ON_REQUEST_START, reqData);

                    try {
                        //=============================================================================
                        // CREATING CONTROLLER
                        //=============================================================================

                        await this.emit(FoliaServerEvent.BEFORE_CONTROLLER_INIT, reqData);
                        reqData.controllerInstance = new reqData.controller(reqData); // Real instance of the controller
                        await this.emit(FoliaServerEvent.AFTER_CONTROLLER_INIT, reqData);


                        //=============================================================================
                        // TRIGGERING ACTION
                        //=============================================================================

                        await this.emit(FoliaServerEvent.BEFORE_ACTION, reqData);
                        reqData.response = await reqData.controllerInstance[reqData.action](reqData);

                        //=============================================================================
                        // HANDLING RESPONSE
                        //=============================================================================

                        if (reqData.controllerInstance._response) {
                            if (reqData.controllerInstance._response instanceof Promise)
                                reqData.response = await reqData.controllerInstance._response;
                            else
                                reqData.response = reqData.controllerInstance._response
                        }
                        await this.emit(FoliaServerEvent.AFTER_ACTION, reqData);

                        if (!reqData.response)
                            res.status(204).send();
                        else if (reqData.response.send && typeof reqData.response.send === "function") {
                            await this.emit(FoliaServerEvent.BEFORE_RESPONSE_SENT, reqData);
                            try {
                                if (reqData.response?.prepare && typeof reqData.response.prepare === "function")
                                    reqData.response.prepare(reqData);
                                reqData.response.send(res);
                            } catch (err) {
                                console.error(err);
                                throw new Error(`Error while sending response ! At route ${reqData.path}`);
                            }
                            await this.emit(FoliaServerEvent.AFTER_RESPONSE_SENT, reqData);
                        }
                        else
                            res.send(reqData.response);

                        await this.emit(FoliaServerEvent.ON_REQUEST_END, reqData);

                    } catch (err) {
                        console.error(err);
                        await this.emit(FoliaServerEvent.ON_REQUEST_END, reqData);
                        next(err);
                    }
                });
            }

            await this.emit(FoliaServerEvent.AFTER_ROUTE_LOADED, data);
        });

        await this.emit(FoliaServerEvent.AFTER_MODULE_ROUTES_LOADED, moduleData);

        this.#showMessages();
    }

    #globals = {}

    /**
     *
     * @param {string} name
     * @param value
     */
    set(name, value) {
        this.#globals[name] = value;
    }

    /**
     *
     * @param {string} name
     * @return {*}
     */
    get(name) {
        return this.#globals[name];
    }

    #eventsObservers = {}

    /**
     *
     * @param {string} event
     * @param {Function} callback
     */
    on(event, callback) {
        if (!this.#eventsObservers[event])
            this.#eventsObservers[event] = [callback];
        else
            this.#eventsObservers[event].push(callback);
    }

    /**
     *
     * @param {string} event
     * @param {*} data
     */
    async emit(event, data) {
        if (this.#eventsObservers[event]) {
            for (const callback of this.#eventsObservers[event]) {
                await callback(data);
            }
        }
    }
}

let FoliaServerEvent = {
    BEFORE_PLUGINS_LOADED: 'FoliaServerEvent_BEFORE_PLUGINS_LOADED',
    AFTER_PLUGINS_LOADED: 'FoliaServerEvent_AFTER_PLUGINS_LOADED',
    BEFORE_PLUGIN_LOADED: 'FoliaServerEvent_BEFORE_PLUGIN_LOADED',
    AFTER_PLUGIN_LOADED: 'FoliaServerEvent_AFTER_PLUGIN_LOADED',
    BEFORE_MODULES_LOADED: 'FoliaServerEvent_BEFORE_MODULES_LOADED',
    AFTER_MODULES_LOADED: 'FoliaServerEvent_AFTER_MODULES_LOADED',
    BEFORE_MODULE_LOADED: 'FoliaServerEvent_BEFORE_MODULE_LOADED',
    AFTER_MODULE_LOADED: 'FoliaServerEvent_AFTER_MODULE_LOADED',
    BEFORE_MODULE_ROUTES_LOADED: 'FoliaServerEvent_BEFORE_MODULE_ROUTES_LOADED',
    BEFORE_ROUTE_LOADED: 'FoliaServerEvent_BEFORE_ROUTE_LOADED',
    AFTER_ROUTE_LOADED: 'FoliaServerEvent_AFTER_ROUTE_LOADED',
    AFTER_MODULE_ROUTES_LOADED: 'FoliaServerEvent_AFTER_MODULE_ROUTES_LOADED',
    ON_REQUEST_START: 'FoliaServerEvent_ON_REQUEST_START',
    BEFORE_CONTROLLER_INIT: 'FoliaServerEvent_BEFORE_CONTROLLER_INIT',
    AFTER_CONTROLLER_INIT: 'FoliaServerEvent_AFTER_CONTROLLER_INIT',
    BEFORE_ACTION: 'FoliaServerEvent_BEFORE_ACTION',
    AFTER_ACTION: 'FoliaServerEvent_AFTER_ACTION',
    BEFORE_RESPONSE_SENT: 'FoliaServerEvent_BEFORE_RESPONSE_SENT',
    AFTER_RESPONSE_SENT: 'FoliaServerEvent_AFTER_RESPONSE_SENT',
    ON_REQUEST_END: 'FoliaServerEvent_ON_REQUEST_END',
    BEFORE_SERVERS_LOADED: 'FoliaServerEvent_BEFORE_SERVERS_LOADED',
    BEFORE_SERVER_LOADED: 'FoliaServerEvent_BEFORE_SERVER_LOADED',
    AFTER_SERVERS_LOADED: 'FoliaServerEvent_AFTER_SERVERS_LOADED',
    ON_SERVER_READY: 'FoliaServerEvent_ON_SERVER_READY',
    BEFORE_EXTENSIONS_LOADED: 'FoliaServerEvent_BEFORE_EXTENSIONS_LOADED',
    BEFORE_EXTENSION_LOADED: 'FoliaServerEvent_BEFORE_EXTENSION_LOADED',
    AFTER_EXTENSION_LOADED: 'FoliaServerEvent_AFTER_EXTENSION_LOADED',
    AFTER_EXTENSIONS_LOADED: 'FoliaServerEvent_AFTER_EXTENSIONS_LOADED',
    BEFORE_ARCHITECTURE_VERIFIED: "FoliaServerEvent_BEFORE_ARCHITECTURE_VERIFIED",
    ON_ARCHITECTURE_ENTRY_VERIFICATION_START: "FoliaServerEvent_ON_ARCHITECTURE_ENTRY_VERIFICATION_START",
    ON_ARCHITECTURE_ENTRY_VERIFICATION_END: "FoliaServerEvent_ON_ARCHITECTURE_ENTRY_VERIFICATION_END",
    AFTER_ARCHITECTURE_VERIFIED: "FoliaServerEvent_AFTER_ARCHITECTURE_VERIFIED"
}

export {
    FoliaServerEvent
}
