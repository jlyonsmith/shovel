import { FileContainsAsserter } from "./FileContainsAsserter"
import { getMockFS } from "./mocks"

test("assert", async (done) => {
  const mock = getMockFS()
  const asserter = new FileContainsAsserter({ fs: mock })
  done()
})

test("run", async (done) => {
  const mock = getMockFS()
  const asserter = new FileContainsAsserter({ fs: mock })

  done()
})
