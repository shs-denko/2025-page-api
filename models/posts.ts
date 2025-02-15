import mongoose from "mongoose";

const postSchema = new mongoose.Schema({
  x: Number,
  y: Number,
  content: String,
  color: String,
  id: String,
});

const Post = mongoose.model("Post", postSchema);

export default Post;
