#include "ebu/list/analysis/handlers/dscp_analyzer.h"

using namespace ebu_list;
using namespace ebu_list::analysis;
using namespace ebu_list::media;

//------------------------------------------------------------------------------

void dscp_analyzer::handle_packet(const udp::datagram& datagram) noexcept
{
    const auto& dscp = datagram.info.dscp;

    if(info_.value)
    {
        info_.is_consistent = info_.is_consistent && (info_.value.value() == dscp);
    }

    info_.value = dscp;
}

const dscp_info& dscp_analyzer::get_info() const noexcept
{
    return info_;
}
