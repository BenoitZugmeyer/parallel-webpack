/**
 * Created by pgotthardt on 07/12/15.
 */

var Promise = require('bluebird');

/**
 * Choose the most correct version of webpack, prefer locally installed version,
 * fallback to the own dependency if there's none.
 * @returns {*}
 */
function getWebpack() {
    try {
        return require(process.cwd() + '/node_modules/webpack');
    } catch(e) {
        return require('webpack');
    }
}

function getAppName(webpackConfig) {
    return webpackConfig.name || webpackConfig.output.filename;
}

function getOutputOptions(webpackConfig, options) {
    var outputOptions = Object.create(webpackConfig.stats || {});
    if(typeof options.modulesSort !== 'undefined') {
        outputOptions.modulesSort = options.modulesSort;
    }
    if(typeof options.chunksSort !== 'undefined') {
        outputOptions.chunksSort = options.chunksSort;
    }
    if(typeof options.assetsSort !== 'undefined') {
        outputOptions.assetsSort = options.assetsSort;
    }
    if(typeof options.exclude !== 'undefined') {
        outputOptions.exclude = options.exclude;
    }
    if(typeof options.colors !== 'undefined') {
        outputOptions.colors = options.colors;
    }
    return outputOptions;
}

/**
 * Create a single webpack build using the specified configuration.
 * Calls the done callback once it has finished its work.
 *
 * @param {string} configuratorFileName The app configuration filename
 * @param {boolean} watch If `true`, then the webpack watcher is being run; if `false`, runs only ones
 * @param {Number} index The configuration index
 * @param {Function} done The callback that should be invoked once this worker has finished the build.
 */
module.exports = function(configuratorFileName, options, index, done) {
    var config = require(configuratorFileName),
        watch = !!options.watch,
        silent = !!options.json;
    if(Array.isArray(config)) {
        config = config[index];
    }
    Promise.resolve(config).then(function(webpackConfig) {
        var webpack = getWebpack(),
            outputOptions = getOutputOptions(webpackConfig, options),
            finishedCallback = function(err, stats) {
                if(err) {
                    if(!silent) {
                        console.error('[WEBPACK] Error building %s', getAppName(webpackConfig));
                        console.log(err);
                    }
                    done(err);
                    return;
                }
                if(!silent) {
                    console.log(stats.toString(outputOptions));
                    console.log('[WEBPACK] Finished building %s', getAppName(webpackConfig));
                }
                if(!watch) {
                    done(null, JSON.stringify(stats.toJson(outputOptions), null, 2));
                }
            };
        if(!silent) {
            console.log('[WEBPACK] Started %s %s', watch ? 'watching' : 'building', getAppName(webpackConfig));
        }
        var compiler = webpack(webpackConfig),
            watcher;
        compiler.plugin('done', function(stats) {
            if (stats.compilation.errors && stats.compilation.errors.length) {
                if(!silent) {
                    console.log(stats.compilation.errors);
                }
                done(stats);
                process.exit(1);
            }
        });
        if(watch || webpack.watch) {
            watcher = compiler.watch({}, finishedCallback);
        } else {
            compiler.run(finishedCallback);
        }

        process.on('SIGINT', function() {
            if(!silent) {
                console.log('[WEBPACK] Forcefully shutting down %s', getAppName(webpackConfig));
            }
            if(watcher) watcher.close(done);
        });
    });
};
