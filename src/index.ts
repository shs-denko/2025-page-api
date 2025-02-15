import { Hono } from "hono";
import type { WSContext } from "hono/ws";
import mongoose from "mongoose";
import Post from "../models/posts.ts";
import { upgradeWebSocket } from "hono/deno";

const app = new Hono();

const password = "password";
const mongoUrl = "mongodb://localhost:27017/denko";
const sessions: WSContext[] = [];

mongoose.connect(mongoUrl).then(() => {
  console.log("MongoDB connected");
  Deno.serve(app.fetch);
});

app.get(
  "/ws/" + password,
  upgradeWebSocket((c) => {
    return {
      onOpen: async (event, ws) => {
        sessions.push(ws);
        const posts = await Post.find();
        ws.send(
          JSON.stringify({
            type: "init",
            posts: posts.map((post) => ({
              x: post.x,
              y: post.y,
              content: post.content,
              color: post.color,
              id: post.id,
            })),
          }),
        )
      },
      onMessage: async (event, ws) => {
        let text;
        if (typeof event.data === "string") {
          text = event.data;
        } else if (event.data instanceof Blob) {
          text = await event.data.text();
        } else if (event.data instanceof ArrayBuffer) {
          text = new TextDecoder().decode(event.data);
        } else {
          text = "";
        }
        const data = JSON.parse(text);
        if (data.type === "create") {
          const id = uuidv4();
          if (!data.note.x || !data.note.y || !data.note.content || !data.note.color) {
            ws.send(JSON.stringify({ type: "error", message: "Invalid data" }));
            return;
          }
          if (data.cotent === "" || data.content > 200) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Content is empty or too long",
              }),
            );
            return;
          }
          const note = {
            x: data.note.x,
            y: data.note.y,
            content: data.note.content,
            color: data.note.color,
            id,
          }
          await Post.create(note);
          sessions.forEach((session) => {
            session.send(
              JSON.stringify({
                type: "create",
                note,
              }),
            );
          });
          return;
        }
        if (data.type === "move") {
          if (data.note.x === undefined || data.note.y === undefined || !data.note.id) {
            ws.send(JSON.stringify({ type: "error", message: "Invalid data" }));
            return;
          }
          const post = await Post.findOneAndUpdate({ id: data.note.id }, {
            x: data.note.x,
            y: data.note.y,
          });
          if (!post) {
            ws.send(JSON.stringify({ type: "error", message: "Not found" }));
            return;
          }
          sessions.forEach((session) => {
            session.send(JSON.stringify({ type: "move", note: data.note }));
          });
        }
      },
      onClose: () => {
        for (let i = 0; i < sessions.length; i++) {
          const session = sessions[i];
          if (session.readyState === WebSocket.CLOSED) {
            sessions.splice(i, 1);
          }
        }
      },
    };
  }),
);

function uuidv4() {
  // Use Node's crypto.randomUUID if available
  if (
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  // Fallback: generate a UUID v4 using crypto.getRandomValues
  return ([1e7] as any + -1e3 + -4e3 + -8e3 + -1e11).replace(
    /[018]/g,
    (c: any) => {
      const random = crypto.getRandomValues(new Uint8Array(1))[0];
      return ((+c) ^ (random & (15 >> ((+c) / 4)))).toString(16);
    },
  );
}
