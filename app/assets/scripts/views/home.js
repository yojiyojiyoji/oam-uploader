'use strict';
var url = require('url');
var React = require('react/addons');
var ValidationMixin = require('react-validation-mixin');
var Joi = require('joi');
var nets = require('nets');
var Scene = require('../components/scene');
var apiUrl = require('../config.js').OAMUploaderApi;

var Home = module.exports = React.createClass({
  displayName: 'Home',

  mixins: [ValidationMixin],

  validatorTypes:  {
    'uploader-name': Joi.string().allow('').label('Name'),
    'uploader-token': Joi.string().required().hex().length(128).label('Token'),
    'uploader-email': Joi.string().email().label('Email'),

    'scenes': Joi.array().items(
      Joi.object().keys({
        'title': Joi.string().min(1).required(),
        'platform-type': Joi.string().required().valid('satellite', 'aircraft', 'uav', 'ballon', 'kite'),
        'sensor': Joi.string().required().label('Sensor'),
        'date-start': Joi.date().required().label('Date start'),
        // 'date-end': non required,
        'urls': Joi.string().required().label('Imagery location'),
        'tile-url': Joi.string().allow('').label('Tile service'),
        'provider': Joi.string().required().label('Provider'),
        'contact-type': Joi.string().required().valid('uploader', 'other'),
        'contact-name': Joi.string().allow('').label('Name'),
        'contact-email': Joi.label('Email').when('contact-type', { is: 'other', then: Joi.string().email().required() })
      })
    )
  },

  getInitialState: function() {
    if (process.env.DS_DEBUG) {
      return {
        loading: false,
        feedback: {
          type: null,
          message: null
        },

        // Form properties.
        'uploader-token': '',
        'uploader-name': 'Dummy Dum Dum',
        'uploader-email': 'zimmy@fake.com',
        scenes: [
          this.getSceneDataTemplate()
        ]
      };
    }

    return {
      loading: false,
      feedback: {
        type: null,
        message: null
      },

      // Form properties.
      'uploader-token': '',
      'uploader-name': '',
      'uploader-email': '',
      scenes: [
        this.getSceneDataTemplate()
      ]
    };
  },

  getSceneDataTemplate: function() {
    if (process.env.DS_DEBUG) {
      return {
        'title': 'An imaginary scene',
        'platform-type': 'satellite',
        'sensor': 'x',
        'date-start': new Date().toISOString(),
        'date-end': new Date().toISOString(),
        'urls': 'http://fake-imagery.net/fake.tif',
        'tile-url': '',
        'provider': 'Mocks R Us',
        'contact-type': 'uploader',
        'contact-name': '',
        'contact-email': ''
      };
    }

    return {
      'platform-type': 'satellite',
      'sensor': '',
      'date-start': new Date().toISOString(),
      'date-end': null,
      'urls': '',
      'tile-url': '',
      'provider': '',
      'contact-type': 'uploader',
      'contact-name': '',
      'contact-email': ''
    };
  },

  addScene: function() {
    var scenes = this.state.scenes;
    scenes.push(this.getSceneDataTemplate());
    this.setState({scenes: scenes});
  },

  removeScene: function(sceneIndex) {
    var scenes = this.state.scenes;
    scenes.splice(sceneIndex, 1);
    this.setState({scenes: scenes});
  },

  onSceneValueChange: function(sceneIndex, fieldName, fieldValue) {
    var scenes = this.state.scenes;
    scenes[sceneIndex][fieldName] = fieldValue;
    this.setState({scenes: scenes});
  },

  onValueChange: function(event) {
    var data = {};
    data[event.target.name] = event.target.value;
    this.setState(data);
  },

  resetForm: function() {
    this.setState({
      'uploader-token': null,
      'uploader-name': null,
      'uploader-email': null,
      scenes: [
        this.getSceneDataTemplate()
      ]
    });
  },

  onSubmit: function(event) {
    event.preventDefault();

    // Warning... Controlled HACK.
    // The state should never be changed in this way as it doesn't trigger
    // a render, however it will be updated by the validate function later on.
    // This is needed to clear previous errors as the plugin doesn't handle
    // arrays of objects specially well.
    this.state.errors = {};

    this.validate(function(error, validationErrors) {
      if (error) {
        console.log(validationErrors);
      } else {

        if (this.state.loading) {
          // Submit already in process.
          return;
        }
        this.setState({loading: true});

        // All is well.
        // SUBMIT DATA.
        //
        // 1 - Prepare data in state.
        // 2 - Submit.
        // 3 - Set form feedback with -- this.setFormFeedback(type, message);
        //   - TYPE can be: alert success warning info
        // 4 - Hide loading. -- this.setState({loading: false});
        // 5 - Reset form when success. -- this.resetForm();

        var token = this.state['uploader-token'];

        var uploader = {
          name: this.state['uploader-name'],
          email: this.state['uploader-email']
        };
        var data = {
          uploader: uploader,
          scenes: this.state.scenes.map(function (scene) {
            var other = scene['contact-type'] === 'other';
            var contact = {
              name: other ? scene['contact-name'] : uploader.name,
              email: other ? scene['contact-email'] : uploader.email
            }

            var tms = scene['tile-url'].trim();
            tms = tms.length === 0 ? undefined : tms;

            return {
              contact: contact,
              title: scene.title,
              provider: scene.provider,
              platform: scene['platform-type'],
              sensor: scene.sensor,
              acquisition_start: scene['date-start'],
              acquisition_end: scene['date-end'],
              tms: tms,
              urls: scene.urls.split('\n')
            };
          })
        };
        console.log('valid', data);

        nets({
          url: url.resolve(apiUrl, '/uploads?access_token=' + token),
          method: 'POST',
          body: JSON.stringify(data),
          headers: {
            'Content-Type': 'application/json'
          }
        }, function (err, resp, body) {
          this.setState({loading: false});

          if (resp.statusCode >= 200 && resp.statusCode < 400) {
            var id = JSON.parse(body.toString()).upload;
            this.setFormFeedback('success', (
              <p>Your upload request was successfully submitted and is being
              processed. <a href={'#/status/' + id}>Check upload status.</a></p>
            ));
            this.resetForm();
          } else {
            this.setFormFeedback('alert', (
              <p>There was a problem with the request.<br/>
                The OAM Upload server responded with: {resp.statusCode}<br/>
                {'' + body}
              </p>
            ));
          }
        }.bind(this));
      }
    }.bind(this));
  },

  setFormFeedback: function(type, message) {
    this.setState({feedback: {
      type: type,
      message: message
    }});
  },

  clearFormFeedback: function() {
    this.setState({feedback: {
      type: null,
      message: null
    }});
  },

  renderErrorMessage: function(message) {
    message = message || '';
    if (message.trim().length === 0) { return '' }

    return (
      <div className='message-wrapper'>
        <p className="message message-alert">{message}</p>
      </div>
    );
  },

  renderScene: function(data, index) {
    return (
      <Scene
        key={index}
        total={this.state.scenes.length}
        index={index} data={data}
        onValueChange={this.onSceneValueChange}
        removeScene={this.removeScene}

        handleValidation={this.handleValidation}
        getValidationMessages={this.getValidationMessages}
        renderErrorMessage={this.renderErrorMessage} />
    );
  },

  renderFeedback: function() {
    if (this.state.feedback.type === null) {
      return null;
    }
    var classes = "notification notification-" + this.state.feedback.type;

    return (
      <div className={classes}>
        {this.state.feedback.message}
      </div>
    );
  },

  render: function() {
    return (
      <div>

        <div className="intro-block">
          <p>Welcome to the <a href="http://openaerialmap.org/" title="Visit OpenAerialMap">OpenAerialMap</a> Imagery Uploader. Use the form below to submit your imagery, if you have a valid upload token. Learn how to contribute with imagery by <a href="https://github.com/hotosm/oam-uploader" title="Go to the GitHub repo">reading the documentation</a>.</p>
        </div>

        <section className="panel upload-panel">
          <header className="panel-header">
            <div className="panel-headline">
              <h1 className="panel-title">Upload</h1>
            </div>
          </header>
          <div className="panel-body">

            <form id="upload-form" className="form-horizontal">

              <fieldset className="form-fieldset general">
                <legend className="form-legend">General</legend>
                <div className="form-group">
                  <label className="form-label">Token</label>
                  <div className="form-control-set">
                    <input type="password" className="form-control" placeholder="Key" aria-describedby="help-1" name="uploader-token" onBlur={this.handleValidation('uploader-token')} onChange={this.onValueChange} value={this.state['uploader-token']} />
                    {this.renderErrorMessage(this.getValidationMessages('uploader-token')[0])}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Uploader <span className="visually-hidden">name</span></label>
                  <div className="form-control-set">
                    <input type="text" className="form-control" placeholder="Name (optional)" name="uploader-name" onBlur={this.handleValidation('uploader-name')} onChange={this.onValueChange} value={this.state['uploader-name']} />
                    {this.renderErrorMessage(this.getValidationMessages('uploader-name')[0])}
                  </div>
                </div>
                <div className="form-group">
                <label className="form-label none"><span className="visually-hidden">Uploader email</span></label>
                  <div className="form-control-set">
                    <input type="email" className="form-control" placeholder="Email" name="uploader-email" onBlur={this.handleValidation('uploader-email')} onChange={this.onValueChange} value={this.state['uploader-email']} />
                    {this.renderErrorMessage(this.getValidationMessages('uploader-email')[0])}
                  </div>
                </div>
              </fieldset>

              {this.state.scenes.map(this.renderScene)}

              <div className="form-extra-actions">
                <button type="button" className="bttn-add-scene" onClick={this.addScene} title="Add new scene"><span>New scene</span></button>
              </div>

              <div className="form-note">
                <p>By uploading you agree to Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque facilisis consequat felis, eget blandit augue ullamcorper sit amet.</p>
              </div>

              <div className="form-actions">
                <button type="submit" className="bttn-submit" onClick={this.onSubmit}><span>Submit</span></button>
              </div>

            </form>

          </div>
          <footer className="panel-footer"></footer>
        </section>

        {this.renderFeedback()}

        {this.state.loading ? <p className="loading revealed">Loading</p> : null}
      </div>
    );
  }
});