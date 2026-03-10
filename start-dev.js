const { spawn } = require('child_process');
const { platform } = require('os');

console.log('Starting Response Arena development servers...');

// Start backend server
console.log('Starting backend server...');
const backend = spawn('npm', ['run', 'dev:backend'], {
  stdio: 'inherit',
  shell: platform() === 'win32' // Use shell on Windows
});

backend.on('error', (err) => {
  console.error('Backend server error:', err);
});

// Start frontend server after a delay
setTimeout(() => {
  console.log('Starting frontend server...');
  const frontend = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    shell: platform() === 'win32' // Use shell on Windows
  });

  frontend.on('error', (err) => {
    console.error('Frontend server error:', err);
  });
}, 2000); // Wait 2 seconds for backend to start