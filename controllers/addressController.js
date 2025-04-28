import Address from '../models/addressModel.js';
import asyncHandler from 'express-async-handler';
import { HTTP_STATUS } from '../utils/httpStatus.js';


const validateAddressData = (data) => {
  const errors = [];
  
  if (!data.name || data.name.length < 4) {
    errors.push('Name must be at least 4 characters long');
  }

  // Pincode validation (6 numbers)
  if (!data.pincode || !/^\d{6}$/.test(data.pincode)) {
    errors.push('Pincode must be 6 digits');
  }


  if (!data.phone || !/^\d{10}$/.test(data.phone)) {
    errors.push('Phone number must be 10 digits');
  }

  if (!data.street) {
    errors.push('Street address is required');
  }
  if (!data.city) {
    errors.push('City is required');
  }
  if (!data.state) {
    errors.push('State is required');
  }

  return errors;
};


export const getAllAddresses = asyncHandler(async (req, res) => {
  const addresses = await Address.find({ user: req.user._id });
  res.json(addresses);
});


export const addAddress = asyncHandler(async (req, res) => {
  const { type, name, street, city, state, pincode, phone, isDefault } = req.body;

  // Validate address data
  const validationErrors = validateAddressData({ name, street, city, state, pincode, phone });
  if (validationErrors.length > 0) {
    res.status(HTTP_STATUS.BAD_REQUEST);
    throw new Error(validationErrors.join(', '));
  }

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

  // Validate address data
  const validationErrors = validateAddressData(req.body);
  if (validationErrors.length > 0) {
    res.status(HTTP_STATUS.BAD_REQUEST);
    throw new Error(validationErrors.join(', '));
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
