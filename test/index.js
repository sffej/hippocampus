'use strict';

// Load modules

const Code = require('code');
const Lab = require('lab');
const Hippocampus = require('..');


// Declare internals

const internals = {};


// Test shortcuts

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const describe = lab.describe;
const it = lab.test;


describe('Hippocampus', () => {

    describe('Client', () => {

        const provision = (options, callback) => {

            if (typeof options === 'function') {
                callback = options;
                options = null;
            }

            const client = new Hippocampus.Client(options);
            client.connect((err) => {

                expect(err).to.not.exist();
                client.flush((err) => {

                    expect(err).to.not.exist();
                    return callback(client);
                });
            });
        };

        describe('connect()', () => {

            it('errors on invalid server address', (done) => {

                const client = new Hippocampus.Client({ port: 10000 });
                client.connect((err) => {

                    expect(err).to.exist();
                    done();
                });
            });

            it('ignores connection error after connection', (done) => {

                provision((client) => {

                    client.redis.emit('error', new Error('Ignore'));
                    client.disconnect(done);
                });
            });
        });

        describe('get()', () => {

            it('returns a stored field', (done) => {

                provision((client) => {

                    client.set('key', 'field', { a: 1 }, (err) => {

                        expect(err).to.not.exist();
                        client.get('key', 'field', (err, result) => {

                            expect(err).to.not.exist();
                            expect(result).to.deep.equal({ field: { a: 1 } });
                            client.disconnect(done);
                        });
                    });
                });
            });

            it('returns a stored object', (done) => {

                provision((client) => {

                    client.set('key', null, { a: 1, b: 2 }, (err) => {

                        expect(err).to.not.exist();
                        client.get('key', null, (err, result) => {

                            expect(err).to.not.exist();
                            expect(result).to.deep.equal({ a: 1, b: 2 });
                            client.disconnect(done);
                        });
                    });
                });
            });

            it('returns null on missing field', (done) => {

                provision((client) => {

                    client.get('key', 'field', (err, result) => {

                        expect(err).to.not.exist();
                        expect(result).to.be.null();
                        client.disconnect(done);
                    });
                });
            });

            it('returns null on missing object', (done) => {

                provision((client) => {

                    client.get('key', null, (err, result) => {

                        expect(err).to.not.exist();
                        expect(result).to.be.null();
                        client.disconnect(done);
                    });
                });
            });

            it('errors on disconnected', (done) => {

                const options = {
                    host: '127.0.0.1',
                    port: 6379
                };

                const client = new Hippocampus.Client(options);

                client.get('test1', 'test1', (err) => {

                    expect(err).to.exist();
                    expect(err.message).to.equal('Redis client disconnected');
                    client.disconnect(done);
                });
            });

            it('errors on invalid record', (done) => {

                provision((client) => {

                    client.redis.hset('key', 'field', '{', (err) => {

                        expect(err).to.not.exist();
                        client.get('key', 'field', (err, result) => {

                            expect(err).to.exist();
                            expect(err.message).to.equal('Invalid cache record');
                            client.disconnect(done);
                        });
                    });
                });
            });

            it('errors on redis hget error', (done) => {

                provision((client) => {

                    client.redis.hget = (key, field, next) => next(new Error('failed'));

                    client.get('key', 'field', (err, result) => {

                        expect(err).to.exist();
                        client.disconnect(done);
                    });
                });
            });

            it('errors on redis hgetall error', (done) => {

                provision((client) => {

                    client.redis.hgetall = (key, next) => next(new Error('failed'));

                    client.get('key', null, (err, result) => {

                        expect(err).to.exist();
                        client.disconnect(done);
                    });
                });
            });
        });

        describe('set()', () => {

            it('expires a stored field', (done) => {

                provision({ ttl: 50 }, (client) => {

                    client.set('key', 'field', { a: 1 }, (err) => {

                        expect(err).to.not.exist();
                        client.get('key', 'field', (err, result1) => {

                            expect(err).to.not.exist();
                            expect(result1).to.deep.equal({ field: { a: 1 } });

                            setTimeout(() => {

                                client.get('key', 'field', (err, result2) => {

                                    expect(err).to.not.exist();
                                    expect(result2).to.be.null();
                                    client.disconnect(done);
                                });
                            }, 50);
                        });
                    });
                });
            });

            it('expires a stored object', (done) => {

                provision({ ttl: 50 }, (client) => {

                    client.set('key', null, { a: 1 }, (err) => {

                        expect(err).to.not.exist();
                        client.get('key', 'a', (err, result1) => {

                            expect(err).to.not.exist();
                            expect(result1).to.deep.equal({ a: 1 });

                            setTimeout(() => {

                                client.get('key', 'field', (err, result2) => {

                                    expect(err).to.not.exist();
                                    expect(result2).to.be.null();
                                    client.disconnect(done);
                                });
                            }, 50);
                        });
                    });
                });
            });

            it('errors on disconnected', (done) => {

                const options = {
                    host: '127.0.0.1',
                    port: 6379
                };

                const client = new Hippocampus.Client(options);

                client.set('test1', 'test1', { some: 'value' }, (err) => {

                    expect(err).to.exist();
                    expect(err.message).to.equal('Redis client disconnected');
                    client.disconnect(done);
                });
            });

            it('errors on circular object (field)', (done) => {

                provision((client) => {

                    const invalid = {};
                    invalid.a = invalid;

                    client.set('key', 'field', invalid, (err) => {

                        expect(err).to.exist();
                        expect(err.message).to.equal('Converting circular structure to JSON');
                        client.disconnect(done);
                    });
                });
            });

            it('errors on circular object (object)', (done) => {

                provision((client) => {

                    const invalid = {};
                    invalid.a = invalid;

                    client.set('key', null, invalid, (err) => {

                        expect(err).to.exist();
                        expect(err.message).to.equal('Converting circular structure to JSON');
                        client.disconnect(done);
                    });
                });
            });

            it('errors on redis hset error', (done) => {

                provision((client) => {

                    client.redis.hset = (key, field, value, next) => next(new Error('failed'));

                    client.set('key', 'field', 'value', (err, result) => {

                        expect(err).to.exist();
                        client.disconnect(done);
                    });
                });
            });

            it('errors on redis hmset error', (done) => {

                provision((client) => {

                    client.redis.hmset = (key, pairs, next) => next(new Error('failed'));

                    client.set('key', null, {}, (err, result) => {

                        expect(err).to.exist();
                        client.disconnect(done);
                    });
                });
            });

            it('errors on redis exists error', (done) => {

                provision({ ttl: 50 }, (client) => {

                    client.redis.exists = (key, next) => next(new Error('failed'));

                    client.set('key', null, { a: 1 }, (err, result) => {

                        expect(err).to.exist();
                        client.disconnect(done);
                    });
                });
            });
        });

        describe('drop()', () => {

            it('drops field', (done) => {

                provision((client) => {

                    client.set('key', null, { a: 1, b: 2 }, (err) => {

                        expect(err).to.not.exist();
                        client.get('key', null, (err, result1) => {

                            expect(err).to.not.exist();
                            expect(result1).to.deep.equal({ a: 1, b: 2 });

                            client.drop('key', 'b', (err) => {

                                expect(err).to.not.exist();
                                client.get('key', null, (err, result2) => {

                                    expect(err).to.not.exist();
                                    expect(result2).to.deep.equal({ a: 1 });
                                    client.disconnect(done);
                                });
                            });
                        });
                    });
                });
            });

            it('drops object', (done) => {

                provision((client) => {

                    client.set('key', null, { a: 1, b: 2 }, (err) => {

                        expect(err).to.not.exist();
                        client.get('key', null, (err, result1) => {

                            expect(err).to.not.exist();
                            expect(result1).to.deep.equal({ a: 1, b: 2 });

                            client.drop('key', null, (err) => {

                                expect(err).to.not.exist();
                                client.get('key', null, (err, result2) => {

                                    expect(err).to.not.exist();
                                    expect(result2).to.be.null();
                                    client.disconnect(done);
                                });
                            });
                        });
                    });
                });
            });

            it('errors on disconnected', (done) => {

                const options = {
                    host: '127.0.0.1',
                    port: 6379
                };

                const client = new Hippocampus.Client(options);

                client.drop('test1', 'test1', (err) => {

                    expect(err).to.exist();
                    expect(err.message).to.equal('Redis client disconnected');
                    client.disconnect(done);
                });
            });
        });

        describe('flush()', () => {

            it('errors on disconnected', (done) => {

                const options = {
                    host: '127.0.0.1',
                    port: 6379
                };

                const client = new Hippocampus.Client(options);

                client.flush((err) => {

                    expect(err).to.exist();
                    expect(err.message).to.equal('Redis client disconnected');
                    client.disconnect(done);
                });
            });
        });
    });
});
