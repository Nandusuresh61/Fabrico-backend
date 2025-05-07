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
        createdAt: { $gte: start, $lte: end },
        status: { $ne: 'cancelled' }
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
      // Define colors and styling
      const colors = {
        primary: '#2563eb',
        secondary: '#64748b',
        accent: '#e2e8f0',
        border: '#cbd5e1'
      };
      
      // Define table layout coordinates with better spacing
      const startX = 50;
      const endX = 550;
      const columnSpacing = 85;
      
      // Header with logo and title
      doc.fontSize(24)
         .fillColor(colors.primary)
         .text('Sales Report', { align: 'center' });
      doc.moveDown(0.5);
      
      // Date range with styled box
      doc.rect(startX, doc.y, endX - startX, 30)
         .fillColor(colors.accent)
         .fill();
      
      doc.fillColor(colors.secondary)
         .fontSize(12)
         .text(
           `Report Period: ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`,
           startX + 10,
           doc.y - 25,
           { align: 'center' }
         );
      doc.moveDown(2);

      // Summary Section with styled boxes
      doc.fontSize(18)
         .fillColor(colors.primary)
         .text('Summary', { underline: false });
      doc.moveDown();

      // Create a grid of summary boxes
      const boxWidth = 250;
      const boxHeight = 60;
      const boxSpacing = 20;
      let currentX = startX;
      let currentY = doc.y;

      // Helper function for summary boxes
      const drawSummaryBox = (title, value, x, y) => {
        doc.rect(x, y, boxWidth, boxHeight)
           .fillColor(colors.accent)
           .fill()
           .fillColor(colors.secondary)
           .fontSize(12)
           .text(title, x + 10, y + 10)
           .fillColor(colors.primary)
           .fontSize(16)
           .text(value, x + 10, y + 30);
      };

      // Draw summary boxes in a grid
      drawSummaryBox('Total Orders', summary.totalOrders.toString(), currentX, currentY);
      drawSummaryBox('Total Sales', `RS : ${summary.totalSales.toFixed(2)}`, currentX + boxWidth + boxSpacing, currentY);
      
      currentY += boxHeight + boxSpacing;
      drawSummaryBox('Total Units', summary.totalUnits.toString(), currentX, currentY);
      drawSummaryBox('Net Sales', `RS : ${(summary.totalSales - summary.productDiscount - summary.couponDiscount).toFixed(2)}`, currentX + boxWidth + boxSpacing, currentY);

      doc.moveDown(4);

      // Payment Methods Section
      doc.fontSize(18)
         .fillColor(colors.primary)
         .text('Payment Distribution');
      doc.moveDown();

      // Draw payment method boxes
      const methodWidth = (endX - startX - (boxSpacing * 2)) / 3;
      currentY = doc.y;
      
      Object.entries(summary.paymentMethods).forEach(([method, count], index) => {
        const x = startX + (methodWidth + boxSpacing) * index;
        doc.rect(x, currentY, methodWidth, 50)
           .fillColor(colors.accent)
           .fill()
           .fillColor(colors.secondary)
           .fontSize(12)
           .text(method.toUpperCase(), x + 10, currentY + 10)
           .fillColor(colors.primary)
           .fontSize(16)
           .text(count.toString(), x + 10, currentY + 30);
      });

      doc.moveDown(4);

      // Orders Table
      doc.fontSize(18)
         .fillColor(colors.primary)
         .text('Order Details');
      doc.moveDown();

      // Table headers with background
      const headerY = doc.y;
      doc.rect(startX, headerY, endX - startX, 25)
         .fillColor(colors.accent)
         .fill();

      // Table headers
      doc.fillColor(colors.secondary)
         .fontSize(11);
      
      const headers = [
        { text: 'Order ID', x: startX + 10 },
        { text: 'Date', x: startX + columnSpacing },
        { text: 'Customer', x: startX + columnSpacing * 2 },
        { text: 'Items', x: startX + columnSpacing * 3, align: 'center', width: 50 },
        { text: 'Product Disc.', x: startX + columnSpacing * 3.7, align: 'right', width: 80 },
        { text: 'Coupon Disc.', x: startX + columnSpacing * 4.5, align: 'right', width: 80 },
        { text: 'Amount', x: startX + columnSpacing * 5.3, align: 'right', width: 80 }
      ];

      headers.forEach(header => {
        doc.text(
          header.text,
          header.x,
          headerY + 7,
          { width: header.width, align: header.align || 'left' }
        );
      });

      doc.moveDown();

      // Table rows with alternating background
      let rowY = doc.y;
      orders.forEach((order, index) => {
        if (rowY > 700) {
          doc.addPage();
          rowY = 50;
        }

        // Alternate row background
        if (index % 2 === 0) {
          doc.rect(startX, rowY, endX - startX, 20)
             .fillColor('#f8fafc')
             .fill();
        }

        doc.fillColor(colors.secondary)
           .fontSize(10);

        // Row data
        doc.text(order.orderId, startX + 10, rowY + 5);
        doc.text(new Date(order.createdAt).toLocaleDateString(), startX + columnSpacing, rowY + 5);
        doc.text(order.user.username, startX + columnSpacing * 2, rowY + 5);
        doc.text(order.items.length.toString(), startX + columnSpacing * 3, rowY + 5, { width: 50, align: 'center' });
        doc.text(`RS : ${(order.productDiscount || 0).toFixed(2)}`, startX + columnSpacing * 3.7, rowY + 5, { width: 80, align: 'right' });
        doc.text(`RS : ${(order.couponDiscount || 0).toFixed(2)}`, startX + columnSpacing * 4.5, rowY + 5, { width: 80, align: 'right' });
        doc.text(`RS : ${order.totalAmount.toFixed(2)}`, startX + columnSpacing * 5.3, rowY + 5, { width: 80, align: 'right' });

        rowY += 20;
      });

      // Footer
      doc.fontSize(8)
         .fillColor(colors.secondary)
         .text(
           'Generated on ' + new Date().toLocaleString(),
           startX,
           doc.page.height - 50,
           { align: 'center' }
         );

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
      { metric: 'Total Sales', value: `RS : ${summary.totalSales.toFixed(2)}` },
      { metric: 'Total Units Sold', value: summary.totalUnits },
      { metric: 'Product Discount', value: `RS : ${summary.productDiscount.toFixed(2)}` },
      { metric: 'Coupon Discount', value: `RS : ${summary.couponDiscount.toFixed(2)}` },
      { metric: 'Net Sales', value: `RS : ${(summary.totalSales - summary.productDiscount - summary.couponDiscount).toFixed(2)}` },
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
        amount: `RS : ${order.totalAmount.toFixed(2)}`,
        discount: `RS : ${order.productDiscount.toFixed(2)}`,
        couponDiscount: `RS : ${(order.couponDiscount || 0).toFixed(2)}`,
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