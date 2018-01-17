var eztrans = require("../../client/eztrans/eztrans");
var async = require('async')
var request = require('./supertest');
module.exports.checksum =
{
	"from": "VTA",
	"to":"no-reply@tripplanner.vta.org",
	"link": "https://devplanner.vta.org/planner?from%5B0%5D=3333%20North%201st%20Street&from%5B1%5D=%20San%20Jose&from%5B2%5D=%20CA%2095134&from%5B3%5D=%20USA&to%5B0%5D=1345%20Blossom%20Hill%20Rd&to%5B1%5D=%20San%20Jose&to%5B2%5D=%20CA%2095118&to%5B3%5D=%20USA&modes=TRANSIT%2CWALK&days=M-F&arriveBy=false&date=01%3A16%3A2018&hour=7&minute=32&fast=false&safe=true&flat=true&routeNumber=0&sidePanel=true",
	"sum": "391ccaedf3f2e611644fa2a34911963f",
	"subject": "Test subject"
};


describe("share", function()
{
	describe("#Verify checksum for share authorization", function() 
	{
		it("Should get a valid sum based of the array information.", function()
		{
			var sum = eztrans.getABC(
			[
				module.exports.checksum.from, 
				module.exports.checksum.to,
				module.exports.checksum.link
			]);
			sum.should.equal(module.exports.checksum.sum);
		});
	});
	describe("#Email", function()
	{
		it("Should return true if a valid email is entered", function()
		{

		});
	});


	// describe("#Verify that the post request returns 1 on successful post.", function()
	// {
	// 	it('should respond with 1 on successful post.', function(done) 
	// 	{
	// 	    request.post()
	// 	      .send(
	// 	      {
	// 	      	"name": module.exports.checksum.from,
	// 		    "to": module.exports.checksum.to,
	// 		    "subject": module.exports.checksum.subject,
	// 		    "message": "This should be the route details",
	// 		    "link": module.exports.checksum.link,
	// 		    "route": 0,
	// 		    "token": module.exports.checksum.sum
	// 	      })
	// 	      .expect(200)
	// 	      .end(function(err, res) {
	// 	        if (err) done(err);
	// 	        res.body.should.equal(1);
	// 	        done();
	// 	     });
 //  		});
	// });
});

