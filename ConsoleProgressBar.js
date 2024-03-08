export default class ConsoleProgressBar {

    items;
    step;
    current = 0;

    title;

    /**
     *
     * @param {string} title Displayed before the bar
     * @param {number|Array} items
     */
    constructor(title, items) {
        this.title = title;

        if (!items)
            items = 0;

        if (typeof items === "number")
            items = new Array(items);

        this.items = items;

        if (items.length === 0)
            this.step = 100;
        else
            this.step = 100/items.length;

        this.showProgress();
    }

    /**
     * Pass to the next item and show progress.
     * NOTE: Automatically called when using .forEach
     */
    next() {
        this.current++;
        process.stdout.write("\r");
        this.showProgress();
    }

    /**
     * End the current progress by moving to next line.
     * NOTE: Automatically called when using .forEach
     */
    finish() {
        process.stdout.write("\n");
    }

    /**
     * Display current progress bar.
     */
    showProgress() {
        let progress = '';
        for (let i = 0; i < Math.floor(this.current * this.step); i++) {
            progress += '=';
        }
        for (let i = this.current * this.step; i < 100; i++) {
            progress += '-';
        }

        process.stdout.write(`${this.title} [${progress}] ${this.current} / ${this.items.length}`);
    }

    /**
     * Loop over the items and provides a callback with the item and the index.
     * Automatically show progress.
     *
     * NOTE: Callback function is awaited on every loop.
     * @param {Function} callback
     * @return {Promise<void>}
     */
    async forEach(callback) {
        while (this.current < this.items.length) {
            await callback(this.items[this.current], this.current);
            this.next();
        }
        this.finish();
    }

    /**
     * A child bar below the parent.
     * Removed on finish.
     *
     * NOTE: Progress of partial bar is shared with parent
     * @param title
     * @param items
     * @return {PartialProgressBar}
     */
    partialBar(title, items) {
        process.stdout.write(`\n`);
        return new PartialProgressBar(title, items, this);
    }

    /**
     * A child bar below the parent.
     * Removed on finish.
     *
     * NOTE: Progress of sub bar is NOT shared with parent
     * @param title
     * @param items
     * @return {SubProgressBar}
     */
    subBar(title, items) {
        process.stdout.write(`\n`);
        return new SubProgressBar(title, items);
    }

}

class SubProgressBar extends ConsoleProgressBar {
    finish() {
        process.stdout.clearLine(0);
        process.stdout.write(`\u001b[1F`);
    }
}

class PartialProgressBar extends ConsoleProgressBar {

    parentBar;
    constructor(title, items, parentBar) {
        super(title, items);
        this.parentBar = parentBar;
    }
    finish() {
        process.stdout.clearLine(0);

        if (this.parentBar.current < this.parentBar.items.length)
            process.stdout.write(`\u001b[1F`);
        else
            process.stdout.write(`\r`);

    }

    next() {
        this.parentBar.current++;
        super.next();
    }

    showProgress() {
        if (this.parentBar) { // undefined on first call (parent's constructor)
            process.stdout.write(`\u001b[1F`);
            this.parentBar.showProgress();
            process.stdout.write(`\n`);
        }

        super.showProgress();
    }
}