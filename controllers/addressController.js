import Address from '../models/addressModel.js';
import asyncHandler from 'express-async-handler';
import { HTTP_STATUS } from '../utils/httpStatus.js';


export const getAllAddresses = asyncHandler(async (req, res) => {
  const addresses = await Address.find({ user: req.user._id });
  res.json(addresses);
});


export const addAddress = asyncHandler(async (req, res) => {
  const { type, name, street, city, state, pincode, phone, isDefault } = req.body;

  if (isDefault) {

    await Address.updateMany(
      { user: req.user._id },
      { $set: { isDefault: false } }
    );
  }

  const address = await Address.create({
    user: req.user._id,
    type,
    name,
    street,
    city,
    state,
    pincode,
    phone,
    isDefault
  });

  res.status(HTTP_STATUS.CREATED).json(address);
});


export const editAddress = asyncHandler(async (req, res) => {
  const address = await Address.findOne({
    _id: req.params.id,
    user: req.user._id
  });

  if (!address) {
    res.status(HTTP_STATUS.NOT_FONUD);
    throw new Error('Address not found');
  }

  if (req.body.isDefault) {
    await Address.updateMany(
      { user: req.user._id },
      { $set: { isDefault: false } }
    );
  }

  const updatedAddress = await Address.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );

  res.json(updatedAddress);
});


export const deleteAddress = asyncHandler(async (req, res) => {
  const address = await Address.findOne({
    _id: req.params.id,
    user: req.user._id
  });

  if (!address) {
    res.status(HTTP_STATUS.NOT_FONUD);
    throw new Error('Address not found');
  }

  await Address.findByIdAndDelete(req.params.id);
  
  res.json({ message: 'Address removed' });
});


export const setDefaultAddress = asyncHandler(async (req, res) => {

  await Address.updateMany(
    { user: req.user._id },
    { $set: { isDefault: false } }
  );


  const address = await Address.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { isDefault: true },
    { new: true }
  );

  if (!address) {
    res.status(HTTP_STATUS.NOT_FONUD);
    throw new Error('Address not found');
  }

  res.json(address);
});
