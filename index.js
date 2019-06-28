
const path = require('path');
const fs = require('fs');

function help() {
    console.log("Usage: node index.js --input=[path] [options]")
    console.log("Options: \n \
    --output=dirpath Where dirpath is the name of the output directory \
    ");
}

function copyRecursiveSync(src, dest) {
    let exists = fs.existsSync(src);

    if (!exists) {
        return;
    }
    let stats = fs.statSync(src);
    let isDirectory = stats.isDirectory();
    if (isDirectory) {
        if (!fs.existsSync(dest)){
            fs.mkdirSync(dest);
        }
        fs.readdirSync(src).forEach((childItemName) => {
            copyRecursiveSync(path.join(src, childItemName),
                            path.join(dest, childItemName));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}

function walkSync (dir, filelist) {
    let files = fs.readdirSync(dir);
    filelist = filelist || [];
    files.forEach((file) => {
      if (fs.statSync(dir + '/' + file).isDirectory()) {
        filelist = walkSync(dir + '/' + file, filelist);
      }
      else {
        filelist.push(dir + '/' + file);
      }
    });
    return filelist;
};

function getPathToFile(pathToFile) {
    return pathToFile.substring(0, pathToFile.lastIndexOf('/')+1)
}

function replaceSourceMaps(dir) {
    let files = [];
    walkSync(dir,files);

    files.filter((f) => { return f.endsWith('.js')})
    .forEach((fileName) => {
        let start = Date.now()
        
        let currentContent = fs.readFileSync(fileName, 'utf8');
        lines = currentContent.toString().split("\n");
        let newContent = "";
        let hasChanges = false;
        let newLines = lines.map((line) => {
            if (line.startsWith("//# sourceMappingURL="))
            {
                const sourceMapFileNameRegex = /(\w+\.)*map/g;
                let sourceMapName = line.match(sourceMapFileNameRegex);
                if (!sourceMapName) {
                    // Noting to do here
                    return line;
                }
                let sourceMapFullPath = getPathToFile(fileName) + sourceMapName;
                let sourceMapContent = Buffer.from(fs.readFileSync(sourceMapFullPath, 'utf8'));
                hasChanges = true;
                return line.replace(sourceMapFileNameRegex,
                    `data:application/json;charset=utf-8;base64,${sourceMapContent.toString('base64')}`);
            }
            return line;
        });

        if (hasChanges) {
            newLines.forEach((line) => {newContent += line + '\n';});
            fs.writeFileSync(fileName, newContent, "utf8");
        }
        console.info(`Execution time for ${fileName} time: %dms old bytes: ${currentContent.length} new bytes: ${newContent.length} lines: ${lines.length} changed: ${hasChanges}`, new Date() - start);
    });
}

function processArguments(args) {
    process.argv.slice(2).forEach((arg) => {
        parts = arg.split('=');
        let name = parts[0].match(/\w+/);
        args[name] = parts[1];
    });
}

function validateArguments(args) {
    if (!args.input) {
        help();
        process.exit(1);
    }

    if (!fs.existsSync(args.input)) {
        console.log(`Invalid source path: ${args.input}`);
        process.exit(1);
    }
}

function main() {
    var args = {};

    processArguments(args);
    validateArguments(args);

    console.log(`Run source map embeder for directory: ${args.input}`)

    if (args.output) {
        copyRecursiveSync(args.input, args.output);
        replaceSourceMaps(args.output);
    }
    else {
        replaceSourceMaps(args.input);
    }
}

main();