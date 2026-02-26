const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const reviewSchema = new mongoose.Schema({
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    comment: String,
    rating: { type: Number, min: 1, max: 5 },
    createdAt: {
        type: Date,
        default: Date.now()
    }

});
module.exports = mongoose.model('Review', reviewSchema);
