#include "catch2/catch.hpp"
#include "ebu/list/net/ethernet/decoder.h"

using namespace ebu_list;

namespace bisect::bimo
{
    bool operator==(const bimo::owning_view& lhs, const bimo::owning_view& rhs) { return lhs.view() == rhs.view(); }
} // namespace bisect::bimo
//------------------------------------------------------------------------------

SCENARIO("decode Ethernet PDU")
{
    GIVEN("a packet")
    {
        const auto packet_bytes = to_byte_array(
            0x01, 0x00, 0x5e, 0x00, 0x01, 0x02, 0x40, 0xa3, 0x6b, 0xa0, 0x2c, 0x26, 0x08, 0x00, 0x45, 0x00, 0x04, 0xe0,
            0x00, 0x00, 0x40, 0x00, 0xff, 0x11, 0xc4, 0x8d, 0xc0, 0xa8, 0x01, 0xd4, 0xef, 0x00, 0x01, 0x02, 0xc3, 0x50,
            0xc3, 0x50, 0x04, 0xcc, 0x00, 0x00, 0x80, 0x60, 0xcf, 0xa0, 0x67, 0x34, 0xa4, 0x24, 0x00, 0x00, 0x00, 0x00,
            0x56, 0x57, 0x04, 0xb0, 0x00, 0x00, 0x00, 0x00, 0x7e, 0x0f, 0x88, 0x11, 0x4c, 0x7e, 0x1b, 0xc8, 0x12, 0x0c,
            0x7e, 0x22, 0x08, 0x12, 0x14, 0x7e, 0x20, 0x88, 0x12, 0x08, 0x7e, 0x22, 0x88, 0x12, 0x2c, 0x7e, 0x22, 0x88,
            0x12, 0x2c, 0x7e, 0x22, 0x88, 0x12, 0x2c, 0x7e, 0x22, 0x88, 0x12, 0x2c, 0x7b, 0x23, 0x08, 0x62, 0x30, 0x7a,
            0x23, 0x08, 0x82, 0x30, 0x7a, 0x23, 0x08, 0x82, 0x30, 0x7a, 0x23, 0x08, 0x82, 0x30, 0x7a, 0x21, 0xc8, 0x82,
            0x1c, 0x7a);

        auto data                  = oview(make_static_sbuffer(packet_bytes));
        auto [_, expected_payload] = split(oview(data), 14);
        (void)_;

        WHEN("we decode it")
        {
            const auto [header, payload] = ethernet::decode(std::move(data));

            THEN("it is correct")
            {
                REQUIRE(header.source_address == ethernet::to_mac_address("40:a3:6b:a0:2c:26"));
                REQUIRE(header.destination_address == ethernet::to_mac_address("01:00:5e:00:01:02"));
                REQUIRE(header.type == ethernet::payload_type::IPv4);
                REQUIRE(payload == expected_payload);
            }
        }
    }
}

SCENARIO("decode Ethernet with VLAN 802.1Q")
{
    GIVEN("a packet")
    {
        const auto packet_bytes = to_byte_array(
            0x00, 0x19, 0x06, 0xea, 0xb8, 0xc1, 0x00, 0x18, 0x73, 0xde, 0x57, 0xc1, 0x81, 0x00, 0x00, 0x7b, 0x08, 0x00,
            0x45, 0x00, 0x00, 0x64, 0x00, 0x05, 0x00, 0x00, 0xff, 0x01, 0x44, 0x3f, 0xc0, 0xa8, 0x7b, 0x02, 0xc0, 0xa8,
            0x7b, 0x01, 0x08, 0x00, 0x94, 0x9a, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0c, 0xe9, 0xa2,
            0xab, 0xcd, 0xab, 0xcd, 0xab, 0xcd, 0xab, 0xcd, 0xab, 0xcd, 0xab, 0xcd, 0xab, 0xcd, 0xab, 0xcd, 0xab, 0xcd,
            0xab, 0xcd, 0xab, 0xcd, 0xab, 0xcd, 0xab, 0xcd, 0xab, 0xcd, 0xab, 0xcd, 0xab, 0xcd, 0xab, 0xcd, 0xab, 0xcd,
            0xab, 0xcd, 0xab, 0xcd, 0xab, 0xcd, 0xab, 0xcd, 0xab, 0xcd, 0xab, 0xcd, 0xab, 0xcd, 0xab, 0xcd, 0xab, 0xcd,
            0xab, 0xcd, 0xab, 0xcd, 0xab, 0xcd, 0xab, 0xcd, 0xab, 0xcd);

        auto data                  = oview(make_static_sbuffer(packet_bytes));
        auto [_, expected_payload] = split(oview(data), 18);
        (void)_;

        WHEN("we decode it")
        {
            const auto [header, payload] = ethernet::decode(std::move(data));

            THEN("it is correct")
            {
                REQUIRE(header.source_address == ethernet::to_mac_address("00:18:73:de:57:c1"));
                REQUIRE(header.destination_address == ethernet::to_mac_address("00:19:06:ea:b8:c1"));
                REQUIRE(header.type == ethernet::payload_type::IPv4);
                REQUIRE(payload == expected_payload);
            }
        }
    }
}

//------------------------------------------------------------------------------
