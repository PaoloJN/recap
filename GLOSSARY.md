# Recap AI

A side panel that answers questions about the video being watched, grounded in that video's transcript.

## Language

**Research mode**:
A chat-session state in which every question the user sends is answered from the video first and extended with sources from the web. It stays on until the user turns it off, starts a new chat, or switches video.
_Avoid_: web mode, online mode

**Web lookup**:
A single chat turn whose answer may draw on web sources in addition to the video. A turn sent while Research mode is on is a web lookup; so is a one-off "deeper" question from Concepts.
_Avoid_: web search turn, research turn

**Video-first answer**:
An answer anchored in the video's own content and timestamps, where anything taken from the web is cited and kept visibly separate, including where the web contradicts or updates the video.
_Avoid_: grounded answer
