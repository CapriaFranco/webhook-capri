// Test to verify interval is being called
const timerRef = { current: null as any };
let startTime = Date.now();

const intervalId = setInterval(() => {
  const now = Date.now();
  const elapsed = now - startTime;
  console.log('Timer tick:', elapsed);
}, 50);

timerRef.current = intervalId;
console.log('Interval ID stored:', timerRef.current);

// Clean up after 5 seconds
setTimeout(() => {
  clearInterval(timerRef.current);
  console.log('Timer cleared');
}, 5000);
