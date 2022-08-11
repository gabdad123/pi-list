#include "catch2/catch.hpp"
#include "ebu/list/net/ipv4/decoder.h"
using namespace ebu_list;
using namespace ebu_list::ipv4;

//------------------------------------------------------------------------------
namespace
{
    namespace frame_0
    {
        constexpr auto raw = to_byte_array(
            0x45, 0x88, 0x00, 0xb8, 0x00, 0x00, 0x40, 0x00, 0x0a, 0x11, 0x5c, 0xbe, 0xc0, 0xa8, 0x3e, 0x25, 0xef, 0x20,
            0x25, 0x01, 0x13, 0x8c, 0xc3, 0x6e, 0x00, 0xa4, 0x00, 0x00, 0x80, 0x61, 0x54, 0xa1, 0xf6, 0x9a, 0xae, 0x2d,
            0x00, 0x00, 0x00, 0x00, 0xfd, 0xcc, 0x0c, 0xfd, 0xcc, 0x0c, 0xfd, 0xcc, 0x0c, 0xfd, 0xcc, 0x0c, 0xfd, 0xcc,
            0x0c, 0xfd, 0x7a, 0x6b, 0xfd, 0x7a, 0x6b, 0xfd, 0x7a, 0x6b, 0xfd, 0x7a, 0x6b, 0xfd, 0x7a, 0x6b, 0xfd, 0x7a,
            0x6b, 0xfd, 0x7a, 0x6b, 0xfd, 0x7a, 0x6b, 0xfe, 0x8e, 0xdc, 0xfe, 0x8e, 0xdc, 0xfe, 0x8e, 0xdc, 0xfe, 0x8e,
            0xdc, 0xfe, 0x8e, 0xdc, 0xfe, 0x8e, 0xdc, 0xfe, 0x8e, 0xdc, 0xfe, 0x8e, 0xdc, 0x00, 0x97, 0x74, 0x00, 0x97,
            0x74, 0x00, 0x97, 0x74, 0x00, 0x97, 0x74, 0x00, 0x97, 0x74, 0x00, 0x97, 0x74, 0x00, 0x97, 0x74, 0x00, 0x97,
            0x74, 0x02, 0xc0, 0x2d, 0x02, 0xc0, 0x2d, 0x02, 0xc0, 0x2d, 0x02, 0xc0, 0x2d, 0x02, 0xc0, 0x2d, 0x02, 0xc0,
            0x2d, 0x02, 0xc0, 0x2d, 0x02, 0xc0, 0x2d, 0x04, 0xb2, 0xdd, 0x04, 0xb2, 0xdd, 0x04, 0xb2, 0xdd, 0x04, 0xb2,
            0xdd, 0x04, 0xb2, 0xdd, 0x04, 0xb2, 0xdd, 0x04, 0xb2, 0xdd, 0x04, 0xb2, 0xdd, 0x06, 0x61, 0xbe, 0x06, 0x61,
            0xbe, 0x06, 0x61, 0xbe);

        constexpr auto ip_payload_size = 0xA4;
    } // namespace frame_0

    namespace frame_fcs
    {
        constexpr auto raw = to_byte_array(
            0x45, 0x00, 0x01, 0x48, 0x00, 0x00, 0x40, 0x00, 0x3f, 0x11, 0x73, 0xd9, 0x0a, 0x25, 0x8c, 0x03, 0xef, 0xa2,
            0x41, 0x01, 0x23, 0x52, 0x23, 0x50, 0x01, 0x34, 0x00, 0x00, 0x80, 0x61, 0x7b, 0xb6, 0xa7, 0x41, 0x39, 0x9f,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x3e, 0xf6, 0x00, 0x3f, 0x98, 0x00, 0x9c, 0x19, 0x00, 0x9d, 0xaf, 0x00, 0x92,
            0xe7, 0x00, 0x92, 0x13, 0x00, 0x6c, 0x9c, 0x00, 0x6d, 0xbb, 0x00, 0x47, 0x64, 0x00, 0x47, 0xdb, 0x00, 0x34,
            0x7a, 0x00, 0x33, 0xdc, 0x00, 0x00, 0xfb, 0x00, 0x02, 0xcf, 0xff, 0xdc, 0x73, 0xff, 0xde, 0x04, 0xff, 0xd0,
            0x42, 0xff, 0xd1, 0xcf, 0xff, 0xe2, 0xb1, 0xff, 0xe4, 0x37, 0xff, 0xed, 0x62, 0xff, 0xef, 0xaa, 0xff, 0xe6,
            0x6a, 0xff, 0xe6, 0x00, 0x00, 0x06, 0x34, 0x00, 0x06, 0xa6, 0xff, 0xff, 0x5c, 0x00, 0x00, 0xf2, 0xff, 0xe9,
            0x0a, 0xff, 0xe9, 0x98, 0xff, 0xc1, 0x74, 0xff, 0xc2, 0xc9, 0xff, 0x6e, 0xf7, 0xff, 0x70, 0x28, 0xff, 0x57,
            0xab, 0xff, 0x5b, 0xf8, 0xff, 0x6d, 0x67, 0xff, 0x6e, 0xe6, 0xff, 0x98, 0x17, 0xff, 0x98, 0x77, 0xff, 0xce,
            0xdd, 0xff, 0xcf, 0x5c, 0xff, 0xe8, 0x1c, 0xff, 0xe8, 0x07, 0xff, 0xd1, 0x34, 0xff, 0xd0, 0xfc, 0xff, 0xb9,
            0x89, 0xff, 0xb7, 0xcf, 0xff, 0xb2, 0x1f, 0xff, 0xb1, 0xf8, 0xff, 0x96, 0x91, 0xff, 0x99, 0x9b, 0xff, 0xae,
            0xf4, 0xff, 0xb2, 0x87, 0xff, 0xd1, 0xae, 0xff, 0xd2, 0x94, 0xff, 0xca, 0xe1, 0xff, 0xcb, 0x4d, 0xff, 0xb9,
            0xe5, 0xff, 0xba, 0xd3, 0xff, 0x89, 0x80, 0xff, 0x8c, 0x68, 0xff, 0x80, 0xb7, 0xff, 0x81, 0x64, 0xff, 0x7d,
            0x7f, 0xff, 0x7d, 0xb3, 0xff, 0x71, 0x19, 0xff, 0x71, 0x79, 0xff, 0x7b, 0x8d, 0xff, 0x7d, 0x16, 0xff, 0x86,
            0x6f, 0xff, 0x88, 0x67, 0xff, 0xce, 0x5a, 0xff, 0xd0, 0x2d, 0x00, 0x0e, 0x92, 0x00, 0x0f, 0x63, 0x00, 0x15,
            0xc8, 0x00, 0x14, 0xa4, 0xff, 0xe8, 0x64, 0xff, 0xe7, 0xe6, 0xff, 0xaa, 0x95, 0xff, 0xaa, 0x6e, 0xff, 0x84,
            0x43, 0xff, 0x83, 0xc5, 0xff, 0x66, 0xd8, 0xff, 0x69, 0x0d, 0xff, 0x68, 0xfe, 0xff, 0x69, 0x7d, 0xff, 0x62,
            0x8c, 0xff, 0x62, 0x65, 0xff, 0x6f, 0xfc, 0xff, 0x71, 0xc3, 0xff, 0x8d, 0x89, 0xff, 0x8f, 0xef, 0xff, 0xa4,
            0xf2, 0xff, 0xa5, 0x3b, 0x60, 0xc8, 0xd4, 0x2f // FCS
        );

        constexpr auto ip_payload_size = 0x134;
    } // namespace frame_fcs
} // namespace

SCENARIO("IPv4 decoding")
{
    GIVEN("an ethernet frame")
    {
        auto frame = oview(make_static_sbuffer(frame_0::raw));

        WHEN("we decode it")
        {
            const auto [header, payload] = ipv4::decode(std::move(frame));

            THEN("the value is correct")
            {
                REQUIRE(header.source_address == ipv4::from_dotted_string("192.168.62.37"));
                REQUIRE(header.destination_address == ipv4::from_dotted_string("239.32.37.1"));
                REQUIRE(header.type == ipv4::protocol_type::UDP);
                REQUIRE(payload.view().size_bytes() == frame_0::ip_payload_size);
            }
        }
    }

    GIVEN("an ethernet frame with FCS")
    {
        auto frame = oview(make_static_sbuffer(frame_fcs::raw));

        WHEN("we decode it")
        {
            const auto [header, payload] = ipv4::decode(std::move(frame));
            (void)header; // [[maybe_unused]]

            THEN("the value is correct")
            {
                REQUIRE(payload.view().size_bytes() == frame_fcs::ip_payload_size);
            }
        }
    }
}
