import readline from "readline"

readline.emitKeypressEvents(process.stdin)
process.stdin.setRawMode(true)
process.stdin.on("keypress", (str, key) => {
  console.log(str)
  console.log(key)
  process.stdin.setRawMode(false)
})
