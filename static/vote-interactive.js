/* global prioritized */

function assert(statement, message) {
  if (!statement) {
    throw message || "Assertion failed"
  }
}

function storePositioning() {
  for (let index in prioritized) {
    let rank = 1 + parseInt(index)
    let code = prioritized[index]
    let input = document.getElementById("rank-" + code)
    if (input) {
      input.value = rank
    }
  }
}

function moveUp(code) {
  assert(prioritized[0] != code, code + " is already at the very top")

  let index = -1
  for (let i = 1; i < prioritized.length; i++) {
    if (prioritized[i] == code) {
      index = i
      break
    }
  }

  assert(index != -1, "couldn't find " + code + " to move up")
  assert(index != 0)

  let currentElement = document.getElementById("item-" + code)
  assert(currentElement, "element with id item-" + code + " doesn't exist")

  let beforeCode = prioritized[index - 1]
  let beforeElement = document.getElementById("item-" + beforeCode)
  assert(beforeElement, "element with id item-" + beforeCode + " doesn't exist")

  currentElement.classList.remove("moveDown")
  currentElement.classList.remove("moveUp")
  beforeElement.classList.remove("moveDown")
  beforeElement.classList.remove("moveUp")

  beforeElement.classList.remove("above")
  currentElement.classList.add("above")

  beforeElement.parentNode.removeChild(beforeElement)
  beforeElement.classList.add("moveDown")
  currentElement.parentNode.insertBefore(beforeElement, currentElement)

  currentElement.parentNode.removeChild(currentElement)
  currentElement.classList.add("moveUp")
  beforeElement.parentNode.insertBefore(currentElement, beforeElement)

  prioritized[index] = beforeCode
  prioritized[index - 1] = code

  storePositioning()
}

function moveDown(code) {
  assert(
    prioritized[prioritized.length - 1] != code,
    code + " is already at the very bottom"
  )

  let index = -1
  for (let i = prioritized.length - 2; i >= 0; i--) {
    if (prioritized[i] == code) {
      index = i
      break
    }
  }

  assert(index != -1, "couldn't find " + code + " to move down")
  assert(index != prioritized.length - 1)

  let currentElement = document.getElementById("item-" + code)
  assert(currentElement, "element with id item-" + code + " doesn't exist")

  let afterCode = prioritized[index + 1]
  let afterElement = document.getElementById("item-" + afterCode)
  assert(afterElement, "element with id item-" + afterCode + " doesn't exist")

  currentElement.classList.remove("moveDown")
  currentElement.classList.remove("moveUp")
  afterElement.classList.remove("moveDown")
  afterElement.classList.remove("moveUp")

  afterElement.classList.remove("above")
  currentElement.classList.add("above")

  currentElement.parentNode.removeChild(currentElement)
  currentElement.classList.add("moveDown")
  afterElement.parentNode.insertBefore(currentElement, afterElement.nextSibling)
  afterElement.parentNode.removeChild(afterElement)
  afterElement.classList.add("moveUp")
  currentElement.parentNode.insertBefore(afterElement, currentElement)

  prioritized[index] = afterCode
  prioritized[index + 1] = code

  storePositioning()
}
