'use strict';

const containerWorkouts = document.querySelector('.workouts');

const logo = document.getElementById('logo');

const form = document.querySelector('#createForm');
const inputType = document.querySelector('#createType');
const inputDistance = document.querySelector('#createDistance');
const inputDuration = document.querySelector('#createDuration');
const inputCadence = document.querySelector('#createCadence');
const inputElevation = document.querySelector('#createElevation');

const formEdit = document.querySelector('#editForm');
const inputTypeEdit = document.querySelector('#editType');
const inputDistanceEdit = document.querySelector('#editDistance');
const inputDurationEdit = document.querySelector('#editDuration');
const inputCadenceEdit = document.querySelector('#editCadence');
const inputElevationEdit = document.querySelector('#editElevation');

let workoutsValues;

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; //[lat, lng]
    this.distance = distance; // km
    this.duration = duration; // min
  }

  _setDescription() {
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
}

class Running extends Workout {
  type = 'running';
  speed = -999;
  elevationGain = -999;
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';
  pace = -999;
  cadence = -999;
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

//////////////////////////
//Application architecture
class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #currWorkout;
  #currSortElem;
  #createdWorkouts;

  constructor() {
    // get user's position
    this._getPosition();

    // get data from local storage
    this._getLocalStorage();

    // atach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    logo.addEventListener('click', this._showAllMarkers.bind(this));
    formEdit.addEventListener('submit', this._editWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    inputTypeEdit.addEventListener('change', this._toggleElevationFieldEdit);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position!');
        }
      );
  }

  _loadMap(position) {
    const { longitude } = position.coords;
    const { latitude } = position.coords;

    this.#map = L.map('map').setView([latitude, longitude], this.#mapZoomLevel);

    L.tileLayer('https://tile-{s}.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // create draw layer
    const drawnItems = new L.featureGroup();
    this.#map.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
      edit: {
        featureGroup: drawnItems,
      },
    });
    this.#map.addControl(drawControl);

    this.#map.on('draw:created', function (e) {
      const layer = e.layer;
      drawnItems.addLayer(layer);

      //check if the drawn layer is Line
      if (layer instanceof L.Polyline) {
        //get an array of line's coords
        const latlngs = layer.getLatLngs();
        let distance = 0;

        for (let i = 0; i < latlngs.length - 1; i++) {
          // calculate distance between dots
          distance += latlngs[i].distanceTo(latlngs[i + 1]);
        }
        // console.log(`Distance is: ${(distance / 1000).toFixed(2)}m`);
        form.createDistance.value = +(distance / 1000).toFixed(2);
      }
    });

    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _showEditForm() {
    if (this.#currWorkout.type === 'cycling') this._toggleElevationFieldEdit();
    inputTypeEdit.value = this.#currWorkout.type;
    inputDistanceEdit.value = this.#currWorkout.distance;
    inputDurationEdit.value = this.#currWorkout.duration;
    inputCadenceEdit.value = this.#currWorkout.cadence || '';
    inputElevationEdit.value = this.#currWorkout.elevationGain || '';

    formEdit.classList.remove('hidden');
    inputDistanceEdit.focus();
  }

  _hideForm() {
    // clear input fields
    inputCadence.value =
      inputDistance.value =
      inputDuration.value =
      inputElevation.value =
        '';
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _toggleElevationFieldEdit() {
    inputElevationEdit
      .closest('.form__row')
      .classList.toggle('form__row--hidden');
    inputCadenceEdit
      .closest('.form__row')
      .classList.toggle('form__row--hidden');
  }

  _validInputs = (...inputs) => inputs.every(inp => Number.isFinite(inp));
  _positivInputs = (...inputs) => inputs.every(inp => inp > 0);

  _checkInputRunning(distance, duration, cadence) {
    if (
      !this._validInputs(distance, duration, cadence) ||
      !this._positivInputs(distance, duration, cadence)
    ) {
      alert('Inputs have to be positive numbers!');
      return false;
    }
    return true;
  }

  _checkInputCycling(distance, duration, elevation) {
    if (
      !this._validInputs(distance, duration, elevation) ||
      !this._positivInputs(distance, duration)
    ) {
      alert('Inputs have to be positive numbers!');
      return false;
    }
    return true;
  }

  async _whereThatWas(lat, lng) {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en-US`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      return ` ${
        data.address.city || data.address.town || data.address.village
      }, ${data.address.country}`;
    } catch (err) {
      console.log(`Something went wrong: ${err}`);
    }
  }

  async _newWorkout(e) {
    e.preventDefault();
    const { lat, lng } = this.#mapEvent.latlng;
    const currReverseGeopositionString = await this._whereThatWas(lat, lng);
    let workout;

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;

    // If workout running create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      if (!this._checkInputRunning(distance, duration, cadence)) return;
      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // If workout cycling create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      // Check data validation cycling
      if (!this._checkInputCycling(distance, duration, elevation)) return;

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    workout.description += currReverseGeopositionString;
    // Add new object to workout array
    this.#workouts.push(workout);

    // render workout as a marker
    this._renderWorkoutMarker(workout);

    // render workout as a list
    this._renderWorkout(workout);

    // hide form and clear input fields
    this._hideForm();

    // set locale storage to all workouts
    this._setLocalStorage();
  }

  _editWorkout(e) {
    e.preventDefault();

    const distance = +inputDistanceEdit.value;
    const duration = +inputDurationEdit.value;
    const type = inputTypeEdit.value;

    // If workout running create running object
    if (type === 'running') {
      const cadence = +inputCadenceEdit.value;
      // Check data validation
      if (!this._checkInputRunning(distance, duration, cadence)) return;

      this.#currWorkout.pace = duration / distance;
      this.#currWorkout.cadence = cadence;
      this.#currWorkout.speed = -999;
      this.#currWorkout.elevationGain = -999;
    }

    // If workout cycling create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevationEdit.value;
      // Check data validation
      if (!this._checkInputCycling(distance, duration, elevation)) return;
      this.#currWorkout.elevationGain = elevation;
      this.#currWorkout.speed = distance / (duration / 60);
      this.#currWorkout.pace = -999;
      this.#currWorkout.cadence = -999;
    }
    this.#currWorkout.type = type;
    this.#currWorkout.distance = distance;
    this.#currWorkout.duration = duration;

    this._setLocalStorage();
    location.reload();
  }

  _deleteWorkout() {
    const idToDelete = this.#currWorkout.id;

    const result = confirm('Do You want to delete this Workout?');

    if (result) {
      const newWorkouts = this.#workouts.filter(e => e.id !== idToDelete);
      this.#workouts = newWorkouts;
      this._setLocalStorage();
      location.reload();
    }
  }

  #reverseMode = false;
  #sortTargetPrev = null;
  _sortWorkouts() {
    const sortTarget = this.#currSortElem;
    if (this.#sortTargetPrev === sortTarget)
      this.#reverseMode = !this.#reverseMode;
    this.#sortTargetPrev = sortTarget;
    let result;

    if (sortTarget !== 'date') {
      if (this.#reverseMode) {
        result = this.#workouts.sort(function (a, b) {
          return a[sortTarget] - b[sortTarget];
        });
      } else {
        result = this.#workouts.sort(function (a, b) {
          return b[sortTarget] - a[sortTarget];
        });
      }
    }

    if (sortTarget === 'date') {
      if (this.#reverseMode) {
        result = this.#workouts.sort(function (a, b) {
          return new Date(a.date) - new Date(b.date);
        });
      } else {
        result = this.#workouts.sort(function (a, b) {
          return new Date(b.date) - new Date(a.date);
        });
      }
    }
    // console.log(sortTarget);
    // console.log(result);
    this.#createdWorkouts.forEach(el => el.remove());
    result.forEach(el => app._renderWorkout(el));
  }

  _renderWorkoutMarker(workout) {
    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();
  }

  _showAllMarkers() {
    // make a group of all markers
    let markerGroup = L.featureGroup();

    this.#workouts.forEach(function (w) {
      markerGroup.addLayer(L.marker(w.coords));
    });
    // console.log(markerGroup);

    // get borders
    const bounds = markerGroup.getBounds();
    // console.log(bounds);

    //zooming
    this.#map.fitBounds(bounds);
  }

  _renderWorkout(workout) {
    let html = `
        <li class="workout workout--${workout.type}" data-id="${workout.id}">
            <h2 class="workout__title" id="date">${workout.description}</h2>
            <div class="del_div">
            <svg xmlns="http://www.w3.org/2000/svg" width="12"  fill="#aaaaaa" class="bi bi-trash3-fill delete__workout" viewBox="0 0 16 16">
  <path d="M11 1.5v1h3.5a.5.5 0 0 1 0 1h-.538l-.853 10.66A2 2 0 0 1 11.115 16h-6.23a2 2 0 0 1-1.994-1.84L2.038 3.5H1.5a.5.5 0 0 1 0-1H5v-1A1.5 1.5 0 0 1 6.5 0h3A1.5 1.5 0 0 1 11 1.5Zm-5 0v1h4v-1a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5ZM4.5 5.029l.5 8.5a.5.5 0 1 0 .998-.06l-.5-8.5a.5.5 0 1 0-.998.06Zm6.53-.528a.5.5 0 0 0-.528.47l-.5 8.5a.5.5 0 0 0 .998.058l.5-8.5a.5.5 0 0 0-.47-.528ZM8 4.5a.5.5 0 0 0-.5.5v8.5a.5.5 0 0 0 1 0V5a.5.5 0 0 0-.5-.5Z"/>
</svg>
            </div>
            <div class="workout__details">
                <span class="workout__icon" id="distance">${
                  workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
                }</span>
                <span class="workout__value">${workout.distance}</span>
                <span class="workout__unit">km</span>
            </div>
            <div class="workout__details">
                <span class="workout__icon" id="duration">⏱</span>
                <span class="workout__value">${workout.duration}</span>
                <span class="workout__unit">min</span>
            </div>
    `;
    if (workout.type === 'running')
      html += `
          <div class="workout__details">
            <span class="workout__icon" id="pace">⚡️</span>
            <span class="workout__value">${workout.pace.toFixed(1)}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon" id="cadence">🦶🏼</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">spm</span>
          </div>
        </li>
        `;

    if (workout.type === 'cycling')
      html += `
          <div class="workout__details">
            <span class="workout__icon" id="speed">⚡️</span>
            <span class="workout__value">${workout.speed.toFixed(1)}</span>
            <span class="workout__unit">km/h</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon" id="elevationGain">⛰</span>
            <span class="workout__value">${workout.elevationGain}</span>
            <span class="workout__unit">m</span>
          </div>
        </li>
    `;
    form.insertAdjacentHTML('afterend', html);
    this.#createdWorkouts = document.querySelectorAll('.workout');
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );
    this.#currWorkout = workout;

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    // enter to edit mode
    if (e.target.className === 'workout__value') this._showEditForm();

    // enter to deleting workout
    if (e.target.closest('.delete__workout')) this._deleteWorkout();

    // enter sorting
    const sortTriggers = [
      'date',
      'duration',
      'distance',
      'speed',
      'elevationGain',
      'pace',
      'cadence',
    ];
    sortTriggers.forEach(function (el) {
      if (el === e.target.id) {
        // console.log(`sorting by ${el}`);
        app.#currSortElem = el;
        app._sortWorkouts();
      }
    });
  }

  _setLocalStorage() {
    localStorage.setItem('workout', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workout'));

    if (!data) return;

    this.#workouts = data;

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  reset() {
    localStorage.removeItem('workout');
    location.reload();
  }
}

const app = new App();
