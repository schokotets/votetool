/* global parts */

function assert(statement, message) {
  if (!statement) {
    throw message || "Assertion failed"
  }
}

function saveValues() {
  for (let code in parts) {
    document.getElementById("parts-" + code).value = parts[code]
  }
}

function increment(code) {
  let sum = 0
  for (v of Object.values(parts)) {
    sum += v
  }
  if (sum == 20) {
    return
  }

  parts[code]++
  document.getElementById("score-" + code).innerText = parts[code]
  document.getElementById("minusbtn-" + code).classList.remove("disabled")

  sum += 1
  document.getElementById("submitbtn").removeAttribute("disabled")

  for (let sumElement of document.getElementsByClassName("sum")) {
    sumElement.innerText = sum
  }

  if (sum == 20) {
    for (let plusBtn of document.getElementsByClassName("plusbtn")) {
      plusBtn.classList.add("disabled")
    }
  }

  saveValues()
}

function decrement(code) {
  let sum = 0
  for (v of Object.values(parts)) {
    sum += v
  }
  if (sum == 0) {
    return
  }
  if (parts[code] == 0) {
    return
  }

  parts[code]--
  document.getElementById("score-" + code).innerText = parts[code]
  document.getElementById("plusbtn-" + code).classList.remove("disabled")

  sum -= 1

  for (let sumElement of document.getElementsByClassName("sum")) {
    sumElement.innerText = sum
  }

  if (sum == 0) {
    for (let minusBtn of document.getElementsByClassName("minusbtn")) {
      minusBtn.classList.add("disabled")
    }
    document.getElementById("submitbtn").setAttribute("disabled", true)
  }

  if (parts[code] == 0) {
    document.getElementById("minusbtn-" + code).classList.add("disabled")
  }

  for (let plusBtn of document.getElementsByClassName("plusbtn")) {
    plusBtn.classList.remove("disabled")
  }

  saveValues()
}
