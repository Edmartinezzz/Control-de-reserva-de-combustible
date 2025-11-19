try {
    const api = require('./src/lib/api').default;
    console.log('Successfully imported api.ts');

    // Attempt to make a request to trigger the interceptor
    console.log('Attempting request...');
    api.get('/test').catch(err => {
        // We expect a network error or similar, but NOT a ReferenceError for localStorage
        console.log('Request finished (error expected, but not ReferenceError):', err.message);
        if (err.name === 'ReferenceError') {
            console.error('FAILED: ReferenceError detected!');
            process.exit(1);
        }
    });
} catch (error) {
    console.error('Error importing api.ts:', error);
    process.exit(1);
}
