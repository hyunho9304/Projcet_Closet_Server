/*
	URL : /member/signup
	Description : 회원가입
	Content-type : form_data
	method : POST - Body
	Body = {
		member_email : String , 
		member_password : String ,
		member_nickname : String ,
		member_profile : file
	}
*/

const express = require('express');
const router = express.Router();
const pool = require('../../config/dbPool');
const async = require('async');
const moment = require( 'moment' ) ;

const crypto = require('crypto');

const multer = require('multer');
const multerS3 = require('multer-s3');
const aws = require('aws-sdk');
aws.config.loadFromPath('../config/aws_config.json');	//	server 에서는 2개
const s3 = new aws.S3();

const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: 'hyunho9304',
        acl: 'public-read',
        key: function(req, file, callback) {
            callback(null, Date.now() + '.' + file.originalname.split('.').pop());
        }
    })
});

router.post('/', upload.single('member_profile'), function(req, res) {

	let member_email = req.body.member_email ;
	let member_password = req.body.member_password ;
	let member_nickname = req.body.member_nickname ;

	let member_profile = ''

	if( req.file == null ) {
		member_profile = null ;
	}
	else{
		member_profile = req.file.location ;
	}

	let task = [

		function( callback ) {
			pool.getConnection(function(err , connection ) {
				if(err) {
					res.status(500).send({
						status : "fail" ,
						message : "internal server err"
					});
					callback( "getConnection err" );
				} else {
					callback( null , connection ) ;
				}
			});
		} ,

		function( connection , callback ) {

			let checkDuplicationEmailQuery = 'SELECT * FROM Member WHERE member_email = ?' ;

			connection.query( checkDuplicationEmailQuery , member_email , function( err , result ) {
				if(err) {
					res.status(500).send({
						status : "fail" ,
						message : "internal server err"
					}) ;
					connection.release() ;
					callback( "checkDuplicationEmailQuery err" ) ;
				} else {

					if( result.length > 0 ) {
						res.status(401).send({
							status : "fail" ,
							message : "already duplication email in database"
						}) ;
						connection.release() ;
						callback( "already duplication email in database" ) ;
					} else {
						callback( null , connection ) ;
					}
				}
			});	//	connection query
		} ,

		function ( connection , callback ) {

			crypto.randomBytes( 32 , function ( err , buffer ) {
				if(err) {
					res.status(500).send({
						stauts : "fail" ,
						message : "internal server err"
					});
					connection.release() ;
					callback( "cryptoRandomBytes err" ) ;
				} else {

					let salt = buffer.toString( 'base64' ) ;

					crypto.pbkdf2( member_password , salt , 100000 , 64 , 'sha512' , function( err , hashed ) {
						if( err ) {
							res.status(500).send({
								status : "fail" ,
								message : "internal server err"
							}) ;
							connection.release() ;
							callback( "cryptoPbkdf2 err") ;
						} else {

							let cryptopwd = hashed.toString( 'base64' ) ;

							let insertMemberQuery = 'INSERT INTO Member VALUES( ? , ? , ? , ? , ? )' ;
							let queryArr = [ member_email , cryptopwd , salt , member_nickname , member_profile ] ;

							connection.query( insertMemberQuery , queryArr , function( err , result ) {
								if(err) {
									res.status(500).send({
										status : "fail" ,
										message : "internal server err"
									});
									connection.release() ;
									callback( "insertMemberQuery err" );
								} else {
									res.status(201).send({
										status : "success" ,
										message : "successful signup"
									});
									connection.release() ;
									callback( null , "successful signup" );
								}
							}) ;	//	connection query
						}
					}) ;	//	crypto pbkdf2
				}
			});	//	crypto randombytes
		}
	] ;

	async.waterfall(task, function(err, result) {
		
		let logtime = moment().format('MMMM Do YYYY, h:mm:ss a');

		if (err)
			console.log(' [ ' + logtime + ' ] ' + err);
		else
			console.log(' [ ' + logtime + ' ] ' + result);
	}); //async.waterfall
});	//	post

module.exports = router;















