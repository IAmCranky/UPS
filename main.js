require('dotenv').config();
const fs = require('fs');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const axios = require('axios');
const getAuth = require('./auth.js');

async function trackShipment(trackingNumber, authToken) {
  const url = `https://onlinetools.ups.com/api/track/v1/details/${trackingNumber}`;
  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'transId': 'track-request-demo',
        'transactionSrc': 'test'
      }
    });
    const shipment = response.data.trackResponse.shipment[0].package[0];
    const status = shipment.currentStatus.description;
    const etaObj = shipment.deliveryDate?.find(d => d.type === 'DEL');
    const eta = etaObj ? etaObj.date : null;
    const ett = shipment.deliveryTime?.endTime || '';

    // mm/dd
    const deliveryDate = eta ? `${eta.slice(4,6)}/${eta.slice(6,8)}` : '';

    // hh:mm (24h)
    let deliveryTime = '';
    if (ett && ett.length >= 4) {
      let hour = parseInt(ett.slice(0,2));
      let min = ett.slice(2,4);
      let ampm = hour >= 12 ? 'pm' : 'am';
      hour = hour % 12 || 12;
      deliveryTime = `${hour}:${min} ${ampm}`;
}

    return { status, deliveryDate, deliveryTime };
  } catch (e) {
    let msg = e.response?.data?.response?.errors?.[0]?.message || e.message;
    // Return a default error object, so your CSV stays aligned
    return { status: `Error: ${msg}`,deliveryDate: '', deliveryTime: '' };
  }
}

async function main() {
  const rows = [];
  const authToken = await getAuth(); // Get UPS bearer token only once

  // 1. Read all orders/rows
  await new Promise((resolve, reject) => {
    fs.createReadStream('orders.csv')
      .pipe(csv())
      .on('data', row => rows.push(row))
      .on('end', resolve)
      .on('error', reject);
  });

  // 2. For each row, look up the tracking/status
  await Promise.all(rows.map(async row => {
    if (row.TrackingNumber) {
      // Call API for this tracking number
      const result = await trackShipment(row.TrackingNumber.trim(), authToken);
      row.Status = result.status;
      row.ArrivalDate = result.deliveryDate;
      row.ArrivalTime = result.deliveryTime;
    } else {
      row.Status = row.ArrivalDate = row.ArrivalTime = '';
    }
  }));

  // 3. Write the updated rows back to a CSV (overwriting original)
  const inputHeaders = Object.keys(rows[0]).filter(h => 
    !['Status', 'ArrivalDate', 'ArrivalTime'].includes(h));
  const headers = [
    ...inputHeaders.map(id => ({ id, title: id })),
    { id: 'Status', title: 'Status' },
    { id: 'ArrivalDate', title: 'ArrivalDate' },
    { id: 'ArrivalTime', title: 'ArrivalTime' }
  ];
  const csvWriter = createCsvWriter({
    path: 'orders.csv',
    header: headers
  });
  await csvWriter.writeRecords(rows);

  console.log(`Updated ${rows.length} rows in orders.csv`);
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});