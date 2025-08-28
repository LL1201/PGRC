import mongoose from 'mongoose';

export function createObjectId(id)
{
    return new mongoose.Types.ObjectId(id);
}

export function isValidObjectId(id)
{
    return mongoose.Types.ObjectId.isValid(id);
}