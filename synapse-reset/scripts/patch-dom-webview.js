#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const packageRoot = path.resolve(__dirname, "..");
const filePath = path.join(
  packageRoot,
  "node_modules",
  "@expo",
  "dom-webview",
  "ios",
  "DomWebView.swift"
);

const oldBlock = `    if let source,
      let request = RCTConvert.nsurlRequest(source.toDictionary(appContext: appContext)),
      webView.url?.absoluteURL != request.url {
      webView.load(request)
    }`;

const newBlock = `    if let source,
      let dict = source.toDictionary(appContext: appContext) as? [String: Any],
      let uri = (dict["uri"] as? String) ?? (dict["url"] as? String),
      let url = URL(string: uri),
      webView.url?.absoluteURL != url {
      webView.load(URLRequest(url: url))
    }`;

try {
  if (!fs.existsSync(filePath)) {
    console.warn("patch-dom-webview: file not found, skipping");
    process.exit(0);
  }
  let content = fs.readFileSync(filePath, "utf8");
  if (content.includes("RCTConvert.nsurlRequest")) {
    content = content.replace(oldBlock, newBlock);
    fs.writeFileSync(filePath, content);
    console.log("patch-dom-webview: applied RCTConvert fix to DomWebView.swift");
  }
} catch (err) {
  console.warn("patch-dom-webview: ", err.message);
  process.exit(0);
}
