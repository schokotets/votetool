let popup, popup_heading, popup_link, popup_text, popup_ok, ready

function loadPopup() {
  popup = document.getElementById("popup")
  popup_heading = document.getElementById("popup-heading")
  popup_link = document.getElementById("popup-link")
  popup_text = document.getElementById("popup-text")
  popup_ok = document.getElementById("popup-ok")
  popup_ok.addEventListener("click", hidePopup)
  ready = true
}

function showPopup(headline, link, text) {
  if (!ready) return
  popup_heading.innerText = headline
  popup_link.href = link
  popup_text.innerHTML = text
  popup.style.display = "unset"
  document.body.classList.add("noscroll")
}

function hidePopup() {
  popup.style.display = "none"
  document.body.classList.remove("noscroll")
}
