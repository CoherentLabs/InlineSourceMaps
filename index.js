
const path = require('path');
const fs = require('fs');


function help() {
    console.log("Usage: node index.js --input=[path] [options]")
    console.log("Options: \n \
    --output=dirpath Where dirpath is the name of the output directory \
    ");
}

var args = {};
process.argv.slice(2).forEach((arg) => {
    parts = arg.split('=');
    let name = parts[0].match(/\w+/);
    args[name] = parts[1];
});

if (!args.input) {
    help();
    process.exit(1);
}

console.log(`Run source map embeder for directory: ${args.input}`)

function copyRecursiveSync(src, dest) {
    var exists = fs.existsSync(src);
    var stats = exists && fs.statSync(src);
    var isDirectory = exists && stats.isDirectory();
    if (exists && isDirectory) {
        if (!fs.existsSync(dest)){
            fs.mkdirSync(dest);
        }
        fs.readdirSync(src).forEach(function(childItemName) {
        copyRecursiveSync(path.join(src, childItemName),
                            path.join(dest, childItemName));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}

var walkSync = function(dir, filelist) {
    var fs = fs || require('fs'),
        files = fs.readdirSync(dir);
    filelist = filelist || [];
    files.forEach(function(file) {
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

const inputPath = args.input;
let workingDir = inputPath;
if (args.output) {
    const outputPath = args.output;
    copyRecursiveSync(inputPath, outputPath);
    workingDir = outputPath;
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

        newLines.forEach((line) => {newContent += line + '\n';});
        if (hasChanges) {
            fs.writeFileSync(fileName, newContent, "utf8");
        }

        console.info(`Execution time for ${fileName} time: %dms old bytes: ${currentContent.length} new bytes: ${newContent.length} lines: ${lines.length} changed: ${hasChanges}`, new Date() - start);
    });
}

replaceSourceMaps(workingDir);