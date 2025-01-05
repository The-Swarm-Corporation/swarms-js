import { getDoc, getSource, isClass } from 'some-inspect-library'; // Replace with an appropriate library if needed

/**
 * Process the documentation for a given item.
 * 
 * @param {Object} item - The item to process the documentation for.
 * @returns {string} - The processed metadata containing the item's name, documentation, and source code.
 */
function processToolDocs(item) {
    // If item is an instance of a class, get its class
    if (!isClass(item) && item.__proto__) {
        item = item.__proto__.constructor;
    }

    const doc = getDoc(item);
    const source = getSource(item);
    const itemType = isClass(item) ? "Class Name" : "Function Name";
    let metadata = `${itemType}: ${item.name}\n\n`;
    if (doc) {
        metadata += `Documentation:\n${doc}\n\n`;
    }
    metadata += `\n${source}`;
    return metadata;
}