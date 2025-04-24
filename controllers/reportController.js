import asyncHandler from '../middlewares/asyncHandler.js';
import Order from '../models/orderModel.js';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

export const getSalesReport = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  // Validate dates
  if (!startDate || !endDate) {
    return res.status(400).json({ message: 'Start date and end date are required' });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({ message: 'Invalid date format' });
  }

  if (start > end) {
    return res.status(400).json({ message: 'Start date must be before end date' });
  }

  // Use aggregation pipeline for better performance
  const [result] = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'user'
      }
    },
    {
      $unwind: '$user'
    },
    {
      $lookup: {
        from: 'variants',
        localField: 'items.variant',
        foreignField: '_id',
        as: 'variants'
      }
    },
    {
      $group: {
        _id: null,
        orders: { $push: '$$ROOT' },
        totalOrders: { $sum: 1 },
        totalSales: { $sum: '$totalAmount' },
        totalUnits: { $sum: { $reduce: { input: '$items', initialValue: 0, in: { $add: ['$$value', '$$this.quantity'] } } } },
        totalDiscount: {
          $sum: {
            $reduce: {
              input: '$items',
              initialValue: 0,
              in: {
                $multiply: [
                  { $subtract: [{ $arrayElemAt: ['$variants.originalPrice', 0] }, '$$this.price'] },
                  '$$this.quantity'
                ]
              }
            }
          }
        },
        couponDiscount: { $sum: { $ifNull: ['$couponDiscount', 0] } },
        productDiscount: { $sum: { $ifNull: ['$productDiscount', 0] } },
        paymentMethods: {
          $push: '$paymentMethod'
        }
      }
    },
    {
      $project: {
        _id: 0,
        orders: 1,
        summary: {
          totalOrders: '$totalOrders',
          totalSales: '$totalSales',
          totalUnits: '$totalUnits',
          totalDiscount: '$totalDiscount',
          couponDiscount: '$couponDiscount',
          productDiscount: '$productDiscount',
          averageOrderValue: { $divide: ['$totalSales', '$totalOrders'] },
          paymentMethods: {
            cod: { $size: { $filter: { input: '$paymentMethods', cond: { $eq: ['$$this', 'cod'] } } } },
            online: { $size: { $filter: { input: '$paymentMethods', cond: { $eq: ['$$this', 'online'] } } } },
            wallet: { $size: { $filter: { input: '$paymentMethods', cond: { $eq: ['$$this', 'wallet'] } } } }
          }
        }
      }
    }
  ]);

  if (!result) {
    return res.json({
      orders: [],
      summary: {
        totalOrders: 0,
        totalSales: 0,
        totalUnits: 0,
        totalDiscount: 0,
        couponDiscount: 0,
        productDiscount: 0,
        averageOrderValue: 0,
        paymentMethods: { cod: 0, online: 0, wallet: 0 }
      }
    });
  }

  res.json({
    orders: result.orders,
    summary: result.summary
  });
});

export const downloadReport = asyncHandler(async (req, res) => {
  const { format, startDate, endDate } = req.query;
  
  if (!format || !startDate || !endDate) {
    return res.status(400).json({ message: 'Format, start date and end date are required' });
  }

  const orders = await Order.find({
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  }).populate('user', 'username').populate('items.variant');

  // Calculate summary for the report
  const summary = orders.reduce((acc, order) => {
    acc.totalOrders++;
    acc.totalSales += order.totalAmount;
    acc.totalUnits += order.items.reduce((sum, item) => sum + item.quantity, 0);
    acc.productDiscount += order.productDiscount || 0;
    acc.couponDiscount += order.couponDiscount || 0;
    acc.paymentMethods[order.paymentMethod]++;
    return acc;
  }, {
    totalOrders: 0,
    totalSales: 0,
    totalUnits: 0,
    productDiscount: 0,
    couponDiscount: 0,
    paymentMethods: { cod: 0, online: 0, wallet: 0 }
  });


  if (format === 'pdf') {
    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=sales-report.pdf');
    
    try {
      // Header
      doc.fontSize(20).text('Sales Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Period: ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`, { align: 'center' });
      doc.moveDown();

      // Summary Section
      doc.fontSize(16).text('Summary', { underline: true });
      doc.moveDown();
      doc.fontSize(12);
      doc.text(`Total Orders: ${summary.totalOrders}`);
      doc.text(`Total Sales: ₹${summary.totalSales.toFixed(2)}`);
      doc.text(`Total Units Sold: ${summary.totalUnits}`);
      doc.text(`Product Discount: ₹${summary.productDiscount.toFixed(2)}`);
      doc.text(`Coupon Discount: ₹${summary.couponDiscount.toFixed(2)}`);
      doc.text(`Net Sales: ₹${(summary.totalSales - summary.productDiscount - summary.couponDiscount).toFixed(2)}`);
      doc.moveDown();

      // Payment Methods
      doc.text('Payment Methods:');
      Object.entries(summary.paymentMethods).forEach(([method, count]) => {
        doc.text(`  ${method.toUpperCase()}: ${count}`);
      });
      doc.moveDown();

      // Orders Table
      doc.fontSize(16).text('Order Details', { underline: true });
      doc.moveDown();
      doc.fontSize(12);

      // Table headers
      let currentY = doc.y;
      doc.text('Order ID', startX, currentY);
      doc.text('Date', startX + 80, currentY);
      doc.text('Customer', startX + 160, currentY);
      doc.text('Items', startX + 240, currentY);
      doc.text('Product Disc.', startX + 300, currentY);
      doc.text('Coupon Disc.', startX + 380, currentY);
      doc.text('Amount', startX + 460, currentY);
      doc.moveDown();

      // Table rows
      orders.forEach(order => {
        currentY = doc.y;
        if (currentY > 700) {
          doc.addPage();
          currentY = doc.y;
        }
        doc.text(order.orderId, startX, currentY);
        doc.text(new Date(order.createdAt).toLocaleDateString(), startX + 80, currentY);
        doc.text(order.user.username, startX + 160, currentY);
        doc.text(order.items.length.toString(), startX + 240, currentY);
        doc.text(`₹${(order.productDiscount || 0).toFixed(2)}`, startX + 300, currentY);
        doc.text(`₹${(order.couponDiscount || 0).toFixed(2)}`, startX + 380, currentY);
        doc.text(`₹${order.totalAmount.toFixed(2)}`, startX + 460, currentY);
        doc.moveDown();
      });

      doc.pipe(res);
      doc.end();
    } catch (error) {
      doc.end();
      throw new Error('Error generating PDF report: ' + error.message);
    }
    return;
  } else if (format === 'excel') {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');
    
    // Styling
    const headerStyle = {
      font: { bold: true, size: 12 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } },
      alignment: { horizontal: 'center' }
    };

    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 20 },
      { header: 'Value', key: 'value', width: 15 }
    ];

    summarySheet.getRow(1).eachCell(cell => {
      cell.style = headerStyle;
    });

    summarySheet.addRows([
      { metric: 'Total Orders', value: summary.totalOrders },
      { metric: 'Total Sales', value: `₹${summary.totalSales.toFixed(2)}` },
      { metric: 'Total Units Sold', value: summary.totalUnits },
      { metric: 'Product Discount', value: `₹${summary.productDiscount.toFixed(2)}` },
      { metric: 'Coupon Discount', value: `₹${summary.couponDiscount.toFixed(2)}` },
      { metric: 'Net Sales', value: `₹${(summary.totalSales - summary.productDiscount - summary.couponDiscount).toFixed(2)}` },
      { metric: 'COD Orders', value: summary.paymentMethods.cod },
      { metric: 'Online Orders', value: summary.paymentMethods.online },
      { metric: 'Wallet Orders', value: summary.paymentMethods.wallet }
    ]);

    // Orders Sheet
    worksheet.columns = [
      { header: 'Order ID', key: 'orderId', width: 15 },
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Customer', key: 'customer', width: 20 },
      { header: 'Items', key: 'items', width: 10 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Product Discount', key: 'discount', width: 15 },
      { header: 'Coupon Discount', key: 'couponDiscount', width: 15 },
      { header: 'Payment Method', key: 'paymentMethod', width: 15 }
    ];

    // Apply header styling
    worksheet.getRow(1).eachCell(cell => {
      cell.style = headerStyle;
    });
    
    // Add data rows
    orders.forEach(order => {
      const productDiscount = order.items.reduce((sum, item) => {
        return sum + ((item.variant?.originalPrice - item.price) * item.quantity);
      }, 0);

      worksheet.addRow({
        orderId: order.orderId,
        date: new Date(order.createdAt).toLocaleDateString(),
        customer: order.user.username,
        items: order.items.length,
        amount: `₹${order.totalAmount.toFixed(2)}`,
        discount: `₹${order.productDiscount.toFixed(2)}`,
        couponDiscount: `₹${(order.couponDiscount || 0).toFixed(2)}`,
        paymentMethod: order.paymentMethod.toUpperCase()
      });
    });
    
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=sales-report.xlsx'
    );
    
    await workbook.xlsx.write(res);
  }
});