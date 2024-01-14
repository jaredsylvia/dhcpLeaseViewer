const express = require('express');
const app = express();
const leaseFile = '/var/lib/dhcp/dhcpd.leases';
const fs = require('fs');
const net = require('net');
const port = 3903;
const { parse } = require('path');

// Function to read and parse the lease file into an array of objects
function parseLeaseFile() {
    // Read the lease file
    const leaseData = fs.readFileSync(leaseFile, 'utf8');
    
    // Split the lease file into an array of leases
    const leases = leaseData.split('lease');
    
    // Remove the first two elements of the array (it's just the file header)
    leases.shift();
    leases.shift();    
    leases.shift();    

    // Create an empty array to store the parsed leases
    const parsedLeases = [];
    // Loop through the array of leases
    leases.forEach(lease => {
        const leaseLines = lease.split('\n');
        const parsedLease = {};
       
        parsedLease.ip = leaseLines.shift().trim().replace('{', '');
        parsedLease.mac = leaseLines.find(line => line.includes('hardware ethernet')).split(' ')[4].replace(';', '');
        const hostnameLine = leaseLines.find(line => line.includes('client-hostname')) || 0;
        if (hostnameLine != 0) {            
            parsedLease.hostname = hostnameLine.split(' ')[3].replace(';', '').replace('"', '').replace('"', '');
        }
        parsedLeases.push(parsedLease);
    });
    
    return parsedLeases;
}

// Define a route for index.html

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.get('/style.css', (req, res) => {
    res.sendFile(__dirname + '/style.css');
});

// Define a route for the leases page in JSON format
app.get('/leases', (req, res) => {
    // Get the parsed leases
    const leases = parseLeaseFile();
    // Remove duplicate IPs except the newest one
    const uniqueLeases = [];
    leases.forEach(lease => {
        if (uniqueLeases.find(uniqueLease => uniqueLease.ip == lease.ip)) {
            uniqueLeases.splice(uniqueLeases.findIndex(uniqueLease => uniqueLease.ip == lease.ip), 1);
        }        
        if (uniqueLeases.find(uniqueLease => uniqueLease.mac == lease.mac)) {
            uniqueLeases.splice(uniqueLeases.findIndex(uniqueLease => uniqueLease.mac == lease.mac), 1);
        }        
        if (uniqueLeases.find(uniqueLease => uniqueLease.hostname == lease.hostname)) {
            uniqueLeases.splice(uniqueLeases.findIndex(uniqueLease => uniqueLease.hostname == lease.hostname), 1);
        }
        uniqueLeases.push(lease);
    });
    // Send the leases as JSON
    res.json(uniqueLeases);    
});

// Define a route to check if a specific IP has specific port open and return the result as JSON
app.get('/check', (req, res) => {
    // Get the IP and port from the query parameters
    const ip = req.query.ip;
    const port = req.query.port;
    // Create a new socket
    const socket = new net.Socket();
    // Try to connect to the IP and port
    socket.connect(port, ip, () => {
        // If the connection is successful, send a JSON response with the status "open"
        res.json({status: 'open'});
        // Close the socket
        socket.destroy();
    });
    // If the connection fails, send a JSON response with the status "closed"
    socket.on('error', () => {
        res.json({status: 'closed'});
    });
});


// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
