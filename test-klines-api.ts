import axios from 'axios';

const BASE_URL = 'https://api.bydfi.com/api';

async function testKlinesAPI() {
  console.log('='.repeat(60));
  console.log('TESTING BYDFI KLINES API');
  console.log('='.repeat(60));
  
  try {
    // Test 1: Basic klines request
    console.log('\n1. Testing BTCUSDT 1h klines...');
    const endTime = Date.now();
    const startTime = endTime - (24 * 60 * 60 * 1000); // 24 hours ago
    
    const response = await axios.get(`${BASE_URL}/v1/swap/market/klines`, {
      params: { 
        symbol: 'BTCUSDT', 
        interval: '1h',
        startTime,
        endTime
      }
    });
    
    console.log('✓ Status:', response.status);
    console.log('✓ Data type:', typeof response.data);
    console.log('✓ Is array:', Array.isArray(response.data));
    console.log('\nFull response data:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (Array.isArray(response.data)) {
      console.log('✓ Length:', response.data.length);
      console.log('\nFirst candle:');
      console.log(JSON.stringify(response.data[0], null, 2));
      console.log('\nLast candle:');
      console.log(JSON.stringify(response.data[response.data.length - 1], null, 2));
    } else if (response.data && typeof response.data === 'object') {
      console.log('✓ Response is object with keys:', Object.keys(response.data));
      
      if (response.data.data) {
        console.log('✓ Data is wrapped in .data property');
        console.log('✓ Array length:', response.data.data.length);
        console.log('\nFirst item in data:');
        console.log(JSON.stringify(response.data.data[0], null, 2));
      }
    }
    
    // Test 2: With limit parameter
    console.log('\n\n2. Testing with limit=20...');
    const response2 = await axios.get(`${BASE_URL}/v1/swap/market/klines`, {
      params: { 
        symbol: 'BTCUSDT', 
        interval: '1h',
        startTime,
        endTime,
        limit: 20
      }
    });
    
    const length2 = Array.isArray(response2.data) 
      ? response2.data.length 
      : response2.data?.data?.length || 0;
    console.log('✓ Length with limit=20:', length2);
    
    // Test 3: Different intervals
    console.log('\n\n3. Testing different intervals...');
    const intervals = ['1m', '5m', '15m', '1h', '4h'];
    
    for (const interval of intervals) {
      const r = await axios.get(`${BASE_URL}/v1/swap/market/klines`, {
        params: { symbol: 'BTCUSDT', interval, startTime, endTime }
      });
      const len = Array.isArray(r.data) ? r.data.length : r.data?.data?.length || 0;
      console.log(`  ${interval}: ${len} candles`);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('TEST COMPLETE - Check output above to understand API format');
    console.log('='.repeat(60));
    
  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testKlinesAPI();
