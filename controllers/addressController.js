import Address from '../models/addressModel.js';
import asyncHandler from 'express-async-handler';

// @desc    Get all addresses for a user
// @route   GET /api/addresses
// @access  Private
export const getAllAddresses = asyncHandler(async (req, res) => {
  const addresses = await Address.find({ user: req.user._id });
  res.json(addresses);
});

// @desc    Add a new address
// @route   POST /api/addresses
// @access  Private
export const addAddress = asyncHandler(async (req, res) => {
  const { type, name, street, city, state, pincode, phone, isDefault } = req.body;

  if (isDefault) {
    // If new address is default, remove default from other addresses
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

  res.status(201).json(address);
});

// @desc    Edit an address
// @route   PUT /api/addresses/:id
// @access  Private
export const editAddress = asyncHandler(async (req, res) => {
  const address = await Address.findOne({
    _id: req.params.id,
    user: req.user._id
  });

  if (!address) {
    res.status(404);
    throw new Error('Address not found');
  }

  if (req.body.isDefault) {
    // If updating to default, remove default from other addresses
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

// @desc    Delete an address
// @route   DELETE /api/addresses/:id
// @access  Private
export const deleteAddress = asyncHandler(async (req, res) => {
  const address = await Address.findOne({
    _id: req.params.id,
    user: req.user._id
  });

  if (!address) {
    res.status(404);
    throw new Error('Address not found');
  }

  await Address.findByIdAndDelete(req.params.id);
  
  res.json({ message: 'Address removed' });
});

// @desc    Set an address as default
// @route   PUT /api/addresses/:id/default
// @access  Private
export const setDefaultAddress = asyncHandler(async (req, res) => {
  // Remove default from all addresses
  await Address.updateMany(
    { user: req.user._id },
    { $set: { isDefault: false } }
  );

  // Set new default address
  const address = await Address.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { isDefault: true },
    { new: true }
  );

  if (!address) {
    res.status(404);
    throw new Error('Address not found');
  }

  res.json(address);
});
