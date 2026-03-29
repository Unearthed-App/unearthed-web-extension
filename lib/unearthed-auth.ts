import type { Storage } from "@plasmohq/storage"

export const UNEARTHED_AUTH_ERROR = "UNEARTHED_AUTH"

export async function handleUnearthedAuthFailure(storage: Storage) {
  await storage.set("syncPaused", true)
  await storage.set("authError", true)
  try {
    await chrome.action.setBadgeText({ text: "!" })
    await chrome.action.setBadgeBackgroundColor({ color: "#FF0000" })
  } catch {
    /* extension context */
  }
}

export async function clearUnearthedAuthState(storage: Storage) {
  await storage.set("syncPaused", false)
  await storage.set("authError", false)
  try {
    await chrome.action.setBadgeText({ text: "" })
  } catch {
    /* extension context */
  }
}
