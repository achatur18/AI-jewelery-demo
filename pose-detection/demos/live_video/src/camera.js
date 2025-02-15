/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
import * as posedetection from '@tensorflow-models/pose-detection';
import { max, min } from '@tensorflow/tfjs-core';
import * as scatter from 'scatter-gl';

import * as params from './params';
import { isMobile } from './util';

// These anchor points allow the pose pointcloud to resize according to its
// position in the input.
const ANCHOR_POINTS = [[0, 0, 0], [0, 1, 0], [-1, 0, 0], [-1, -1, 0]];
// const ear_index = [3, 4]

// #ffffff - White
// #800000 - Maroon
// #469990 - Malachite
// #e6194b - Crimson
// #42d4f4 - Picton Blue
// #fabed4 - Cupid
// #aaffc3 - Mint Green
// #9a6324 - Kumera
// #000075 - Navy Blue
// #f58231 - Jaffa
// #4363d8 - Royal Blue
// #ffd8b1 - Caramel
// #dcbeff - Mauve
// #808000 - Olive
// #ffe119 - Candlelight
// #911eb4 - Seance
// #bfef45 - Inchworm
// #f032e6 - Razzle Dazzle Rose
// #3cb44b - Chateau Green
// #a9a9a9 - Silver Chalice
const COLOR_PALETTE = [
  '#ffffff', '#800000', '#469990', '#e6194b', '#42d4f4', '#fabed4', '#aaffc3',
  '#9a6324', '#000075', '#f58231', '#4363d8', '#ffd8b1', '#dcbeff', '#808000',
  '#ffe119', '#911eb4', '#bfef45', '#f032e6', '#3cb44b', '#a9a9a9'
];
export class Camera {
  constructor() {
    this.left_ear={y: 0, x: 0, score: 0, name: 'left_ear'}
    this.right_ear={y: 0, x: 0, score: 0, name: 'right_ear'}
    this.neck_center={y: 0, x: 0, score: 0, name: 'neck_center'}
    this.video = document.getElementById('video');
    this.canvas = document.getElementById('output');
    this.ctx = this.canvas.getContext('2d');
    this.earring = document.getElementById('earring');
    this.necklace = document.getElementById('necklace');
    this.scatterGLEl = document.querySelector('#scatter-gl-container');
    this.scatterGL = new scatter.ScatterGL(this.scatterGLEl, {
      'rotateOnStart': true,
      'selectEnabled': false,
      'styles': { polyline: { defaultOpacity: 1, deselectedOpacity: 1 } }
    });
    this.scatterGLHasInitialized = false;
  }

  /**
   * Initiate a Camera instance and wait for the camera stream to be ready.
   * @param cameraParam From app `STATE.camera`.
   */
  static async setupCamera(cameraParam) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(
        'Browser API navigator.mediaDevices.getUserMedia not available');
    }

    const { targetFPS, sizeOption } = cameraParam;
    const $size = params.VIDEO_SIZE[sizeOption];
    const videoConfig = {
      'audio': false,
      'video': {
        facingMode: 'user',
        // Only setting the video to a specified size for large screen, on
        // mobile devices accept the default size.
        width: isMobile() ? params.VIDEO_SIZE['360 X 270'].width : $size.width,
        height: isMobile() ? params.VIDEO_SIZE['360 X 270'].height :
          $size.height,
        frameRate: {
          ideal: targetFPS,
        }
      }
    };

    const stream = await navigator.mediaDevices.getUserMedia(videoConfig);

    const camera = new Camera();
    camera.video.srcObject = stream;

    await new Promise((resolve) => {
      camera.video.onloadedmetadata = () => {
        resolve(video);
      };
    });

    camera.video.play();

    const videoWidth = camera.video.videoWidth;
    const videoHeight = camera.video.videoHeight;
    // Must set below two lines, otherwise video element doesn't show.
    camera.video.width = videoWidth;
    camera.video.height = videoHeight;

    camera.canvas.width = videoWidth;
    camera.canvas.height = videoHeight;
    const canvasContainer = document.querySelector('.canvas-wrapper');
    canvasContainer.style = `width: ${videoWidth}px; height: ${videoHeight}px`;

    // Because the image from camera is mirrored, need to flip horizontally.
    camera.ctx.translate(camera.video.videoWidth, 0);
    camera.ctx.scale(-1, 1);

    camera.scatterGLEl.style =
      `width: ${videoWidth}px; height: ${videoHeight}px;`;
    camera.scatterGL.resize();

    camera.scatterGLEl.style.display =
      params.STATE.modelConfig.render3D ? 'inline-block' : 'none';

    return camera;
  }

  drawCtx() {
    this.ctx.drawImage(
      this.video, 0, 0, this.video.videoWidth, this.video.videoHeight);
  }

  clearCtx() {
    this.ctx.clearRect(0, 0, this.video.videoWidth, this.video.videoHeight);
  }

  /**
   * Draw the keypoints and skeleton on the video.
   * @param poses A list of poses to render.
   */
  drawResults(poses) {
    for (const pose of poses) {
      this.drawResult(pose);
    }
  }

  /**
   * Draw the keypoints and skeleton on the video.
   * @param pose A pose with keypoints to render.
   */
  drawResult(pose) {
    if (pose.keypoints != null) {
      this.drawKeypoints(pose.keypoints);
      this.drawSkeleton(pose.keypoints, pose.id);
    }
    if (pose.keypoints3D != null && params.STATE.modelConfig.render3D) {
      this.drawKeypoints3D(pose.keypoints3D);
    }
  }
  
  drawEarResults(poses) {
    for (const pose of poses) {
      this.drawEarResult(pose);
    }
  }
  /**
   * Draw the keypoints on the video.
   * @param keypoints A list of keypoints.
   */

  drawEarResult(pose) {
    if (pose.keypoints != null) {
      this.drawEarKeypoints(pose.keypoints);
    }
  }
  drawEarKeypoints(keypoints) {
    const keypointInd =
      posedetection.util.getKeypointIndexBySide(params.STATE.model);
    this.ctx.fillStyle = 'Red';
    this.ctx.strokeStyle = 'White';
    this.ctx.lineWidth = params.DEFAULT_LINE_WIDTH;

    this.drawEar(keypoints);
    this.drawNeck(keypoints);
    }


  l2_dist(k1, k2){
    let a=(k1.x-k2.x)
    let b=(k1.y-k2.y)
    return Math.sqrt( a*a + b*b )
  }
    

  drawNeck(keypoints) {
    // If score is null, just show the keypoint.
    const score5 = keypoints[5].score != null ? keypoints[5].score : 1;
    const score6 = keypoints[6].score != null ? keypoints[6].score : 1;
    const scoreThreshold = params.STATE.modelConfig.scoreThreshold || 0;

    const score=Math.min(score5, score6)

    if (score >= scoreThreshold) {
      let thres=6;
      if (isMobile()){
        thres=4
      }
      let keypoint_=JSON.parse(JSON.stringify(keypoints[4]));
  
      keypoint_.x=(keypoints[5].x+keypoints[6].x)/2
      keypoint_.y=(keypoints[5].y+keypoints[6].y)/2

  
      if(this.l2_dist(this.neck_center, keypoint_)>thres){
        this.neck_center=JSON.parse(JSON.stringify(keypoint_));
      }
  
      let hdist = 35*Math.floor((this.l2_dist(keypoints[5], keypoints[6])/20));
      let vdist=(2*hdist)/(3*1.5)
      this.ctx.drawImage(this.necklace, this.neck_center.x-(hdist/4), this.neck_center.y-(vdist/3), hdist/2, vdist);
    }
  }

  
  drawEar(keypoints) {


      let left_ear_=keypoints[3];
      if (isMobile()){
        left_ear_.y+=12
      }else{
        left_ear_.y+=16
      }
      
      let right_ear_=keypoints[4];
      if (isMobile()){
        right_ear_.y+=12
      }else{
        right_ear_.y+=16
      }

      this.drawEarings(left_ear_, "left");
      this.drawEarings(right_ear_, "right");
    
  }

  drawKeypoints(keypoints) {
    const keypointInd =
      posedetection.util.getKeypointIndexBySide(params.STATE.model);
    this.ctx.fillStyle = 'Red';
    this.ctx.strokeStyle = 'White';
    this.ctx.lineWidth = params.DEFAULT_LINE_WIDTH;

    for (const i of keypointInd.middle) {
      this.drawKeypoint(keypoints[i]);
    }

    this.ctx.fillStyle = 'Green';
    for (const i of keypointInd.left) {
      this.drawKeypoint(keypoints[i]);
    }

    this.ctx.fillStyle = 'Orange';
    for (const i of keypointInd.right) {
      this.drawKeypoint(keypoints[i]);
    }
  }

  drawEarings(keypoint, ear) {
    // If score is null, just show the keypoint.
    const score = keypoint.score != null ? keypoint.score : 1;
    const scoreThreshold = params.STATE.modelConfig.scoreThreshold || 0;

    if (score >= scoreThreshold) {
      let thres=8;
      if(isMobile()){
        thres=4;
      }

      let last_ear= JSON.parse(JSON.stringify(this.left_ear));
      if(ear=='right'){
        last_ear= JSON.parse(JSON.stringify(this.right_ear));
      }

      if(this.l2_dist(keypoint, last_ear)>thres){
          
        if(ear=='left'){
          this.left_ear=JSON.parse(JSON.stringify(keypoint));
        }else{
          this.right_ear=JSON.parse(JSON.stringify(keypoint));
        }

        this.ctx.drawImage(this.earring, keypoint.x-15, keypoint.y, 40, 50);

      }else{
        this.ctx.drawImage(this.earring, last_ear.x-15, last_ear.y, 40, 50);

      }
      
    }
  }
  drawKeypoint(keypoint) {
    // If score is null, just show the keypoint.
    const score = keypoint.score != null ? keypoint.score : 1;
    const scoreThreshold = params.STATE.modelConfig.scoreThreshold || 0;

    if (score >= scoreThreshold) {
      const circle = new Path2D();
      circle.arc(keypoint.x, keypoint.y, params.DEFAULT_RADIUS, 0, 2 * Math.PI);
      this.ctx.fill(circle);
      this.ctx.stroke(circle);
      this.ctx.drawImage(this.earring, keypoint.x-15, keypoint.y, 30, 40);
    }
  }

  /**
   * Draw the skeleton of a body on the video.
   * @param keypoints A list of keypoints.
   */
  drawSkeleton(keypoints, poseId) {
    // Each poseId is mapped to a color in the color palette.
    const color = params.STATE.modelConfig.enableTracking && poseId != null ?
      COLOR_PALETTE[poseId % 20] :
      'White';
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = params.DEFAULT_LINE_WIDTH;

    posedetection.util.getAdjacentPairs(params.STATE.model).forEach(([i, j]) => {
      const kp1 = keypoints[i];
      const kp2 = keypoints[j];

      // If score is null, just show the keypoint.
      const score1 = kp1.score != null ? kp1.score : 1;
      const score2 = kp2.score != null ? kp2.score : 1;
      const scoreThreshold = params.STATE.modelConfig.scoreThreshold || 0;

      if (score1 >= scoreThreshold && score2 >= scoreThreshold) {
        this.ctx.beginPath();
        this.ctx.moveTo(kp1.x, kp1.y);
        this.ctx.lineTo(kp2.x, kp2.y);
        this.ctx.stroke();
      }
    });
  }

  drawKeypoints3D(keypoints) {
    const scoreThreshold = params.STATE.modelConfig.scoreThreshold || 0;
    const pointsData =
      keypoints.map(keypoint => ([-keypoint.x, -keypoint.y, -keypoint.z]));

    const dataset =
      new scatter.ScatterGL.Dataset([...pointsData, ...ANCHOR_POINTS]);

    const keypointInd =
      posedetection.util.getKeypointIndexBySide(params.STATE.model);
    this.scatterGL.setPointColorer((i) => {
      if (keypoints[i] == null || keypoints[i].score < scoreThreshold) {
        // hide anchor points and low-confident points.
        return '#ffffff';
      }
      if (i === 0) {
        return '#ff0000' /* Red */;
      }
      if (keypointInd.left.indexOf(i) > -1) {
        return '#00ff00' /* Green */;
      }
      if (keypointInd.right.indexOf(i) > -1) {
        return '#ffa500' /* Orange */;
      }
    });

    if (!this.scatterGLHasInitialized) {
      this.scatterGL.render(dataset);
    } else {
      this.scatterGL.updateDataset(dataset);
    }
    const connections = posedetection.util.getAdjacentPairs(params.STATE.model);
    const sequences = connections.map(pair => ({ indices: pair }));
    this.scatterGL.setSequences(sequences);
    this.scatterGLHasInitialized = true;
  }
}
