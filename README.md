# valgrind-tool

Tool created to parse Valgrind logs to acquire only suppressions and emit it to either stdout or an output file. The command-line tool can receive many files as input or stdin.

In case no output option is provided, the program will automatically start using stdout and disable all kinds of logging.

## Installation

```sh
npm install -g valgrind-tool
yarn add -D valgrind-tool
```

## Usage

```sh
export VALGRIND_COMMAND=valgrind \
    --track-origins=yes --show-leak-kinds=all \
    --leak-check=full --gen-suppressions=all ./app
$VALGRIND_COMMAND | valgrind-tool > a.supp
$VALGRIND_COMMAND | valgrind-tool --output a.supp
valgrind-tool valgrind-log1.log valgrind-log2.log --output valgrind-suppressions.supp
valgrind-tool valgrind-log1.log valgrind-log2.log > valgrind-suppressions.supp
valgrind-tool valgrind-log1.log valgrind-log2.log >> concatenated-valgrind-suppressions.supp
```