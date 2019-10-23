const storage = require("node-persist");
const yargs = require("yargs");
const fs = require("fs");
const { argv } = yargs;

const [command, value, secondValue] = argv._;

const cache = storage.create({
  dir: ".cache",
  stringify: JSON.stringify,
  parse: JSON.parse,
  encoding: "utf8"
});

(async () => {
  await cache.init();
  let tree = (await cache.getItem("tree")) || {};

  const list = () => {
    const logDirectory = (branch, base = "") => {
      Object.keys(branch).forEach(directory => {
        console.log(`${base}${directory}`);
        logDirectory(branch[directory], `${base}  `);
      });
    };
    console.log("LIST");
    logDirectory(tree);
  };

  const create = async path => {
    const directories = path.split("/");
    let branch = tree;

    directories.forEach(directory => {
      if (!branch[directory]) branch[directory] = {};
      branch = branch[directory];
    });
    await cache.setItem("tree", tree);
  };

  const getBranch = path => {
    const directories = path.split("/");
    const lastDirectory = directories.pop();
    let branch = tree;

    const error = missingBranch => {
      return `${missingBranch} does not exist`;
    };

    for (let i = 0; i < directories.length; i++) {
      const directory = directories[i];

      if (directory in branch) {
        branch = branch[directory];
      } else {
        return error(directory);
      }
    }
    if (lastDirectory in branch) {
      return branch;
    } else {
      return error(lastDirectory);
    }
  };

  const remove = async path => {
    const lastDirectory = path.split("/").pop();
    const branch = getBranch(path);

    if (typeof branch === "string") {
      console.log(`Cannot delete ${path} - ${branch}`);
    } else {
      delete branch[lastDirectory];
      await cache.setItem("tree", tree);
    }
  };

  const move = async (from, to) => {
    const toDirectories = to.split("/");
    const lastToDirectory = toDirectories.pop();
    const baseToDirectory = toDirectories.join("/");
    const lastFromDirectory = from.split("/").pop();
    const fromBranch = getBranch(from);

    console.log(`MOVE ${from} ${to}`);
    if (typeof fromBranch === "string") {
      console.log(`Cannot move ${from} - ${fromBranch}`);
    } else {
      let toBranch = tree;

      if (baseToDirectory) {
        create(baseToDirectory);
        toBranch = getBranch(baseToDirectory);
      }
      toBranch[lastToDirectory] = { ...fromBranch[lastFromDirectory] };
      delete fromBranch[lastFromDirectory];
      await cache.setItem("tree", tree);
    }
  };

  const clearData = async () => {
    await cache.setItem("tree", {});
  };

  const execute = (command, value, secondValue) => {
    switch (command) {
      case "create":
      case "CREATE":
        return create(value);
      case "list":
      case "LIST":
        return list();
      case "delete":
      case "DELETE":
        return remove(value);
      case "move":
      case "MOVE":
        return move(value, secondValue);
      case "clear":
      case "CLEAR":
        return clearData();
      default:
        return;
    }
  };

  const runTestCommands = () => {
    fs.readFile("test-commands", "utf8", (err, data) => {
      if (err) {
        console.log("Error running test commands", err);
        return;
      }
      // clearData();
      data.split(/\n/g).forEach(line => {
        const [cmd, val, secondVal] = line.split(" ");
        execute(cmd, val, secondVal);
      });
    });
  };

  if (["test", "TEST"].includes(command)) {
    runTestCommands();
  } else {
    execute(command, value, secondValue);
  }
})();
